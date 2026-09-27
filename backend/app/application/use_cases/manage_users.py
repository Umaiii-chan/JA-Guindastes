"""Gestão de usuários pelo admin (ADR-016 § 2; TASK-038).

- Não há cadastro aberto: quem chama estes casos de uso já foi autorizado como `ADMIN`
  (apresentação) ou é o comando de servidor `app.create_admin`.
- Criar: `username` normalizado (minúsculas, 3–64 `[a-z0-9._-]`), nome de exibição obrigatório,
  senha de 10 a 128 caracteres, perfil; o usuário nasce ativo. Id UUID gerado aqui.
- Atualizar: nome de exibição, perfil, situação e senha, cada um opcional. O `username` não muda.
- Proteções: um admin não pode se desativar nem tirar o próprio perfil de admin
  (`OwnAdminAccessError`), e o sistema nunca fica sem admin ativo (`LastAdminError`).
- Desativar revoga todas as sessões do usuário (ADR-016 § 3).

A garantia de "último admin" fica no repositório (`UserRepository.update`), que confere e grava na
mesma operação atômica (no PostgreSQL, travando as linhas dos admins ativos): conferir aqui e gravar
depois deixaria duas requisições simultâneas rebaixarem, cada uma, um dos dois últimos admins.
"""

from app.application.ports.password_hasher import PasswordHasher
from app.application.ports.session_repository import SessionRepository
from app.application.ports.user_repository import (
    UsernameTakenError,
    UserNotFoundError,
    UserRepository,
)
from app.application.use_cases.authentication import Clock, utc_now
from app.application.use_cases.crane_catalog import IdGenerator, generate_uuid_id
from app.domain.entities.user import (
    User,
    UserRole,
    normalize_display_name,
    normalize_username,
    validate_password,
)
from app.domain.exceptions.user_errors import LastAdminError

__all__ = ["LastAdminError", "ManageUsers", "OwnAdminAccessError"]


class OwnAdminAccessError(Exception):
    """O admin tentou se desativar ou tirar o próprio perfil de admin."""

    def __init__(self) -> None:
        super().__init__("um admin não pode se desativar nem tirar o próprio perfil de admin")


class ManageUsers:
    """Listar, criar e atualizar usuários.

    Erros:
    - `InvalidUserError` (domínio): nome de usuário, nome de exibição ou senha fora das regras;
    - `UsernameTakenError`: o `username` já existe;
    - `UserNotFoundError`: o usuário a atualizar não existe;
    - `OwnAdminAccessError` e `LastAdminError` (domínio, levantado pelo repositório): as proteções
      do ADR-016 § 2.
    """

    def __init__(
        self,
        users: UserRepository,
        sessions: SessionRepository,
        password_hasher: PasswordHasher,
        *,
        clock: Clock = utc_now,
        id_generator: IdGenerator = generate_uuid_id,
    ) -> None:
        self._users = users
        self._sessions = sessions
        self._hasher = password_hasher
        self._clock = clock
        self._id_generator = id_generator

    def list_users(self) -> list[User]:
        return self._users.list_users()

    def create_user(
        self, *, username: str, display_name: str, password: str, role: UserRole
    ) -> User:
        normalized = normalize_username(username)
        name = normalize_display_name(display_name)
        validate_password(password)
        if self._users.get_credentials_by_username(normalized) is not None:
            raise UsernameTakenError(normalized)
        user = User(
            id=self._id_generator(),
            username=normalized,
            display_name=name,
            role=role,
            active=True,
            created_at=self._clock(),
        )
        self._users.add(user, self._hasher.hash(password))
        return user

    def update_user(
        self,
        *,
        actor: User,
        user_id: str,
        display_name: str | None = None,
        role: UserRole | None = None,
        active: bool | None = None,
        password: str | None = None,
    ) -> User:
        current = self._users.get_by_id(user_id)
        if current is None:
            raise UserNotFoundError(user_id)

        name = (
            current.display_name if display_name is None else normalize_display_name(display_name)
        )
        if password is not None:
            validate_password(password)
        updated = User(
            id=current.id,
            username=current.username,
            display_name=name,
            role=current.role if role is None else role,
            active=current.active if active is None else active,
            created_at=current.created_at,
        )

        if current.id == actor.id and current.is_active_admin and not updated.is_active_admin:
            raise OwnAdminAccessError()

        password_hash = None if password is None else self._hasher.hash(password)
        # `LastAdminError` vem daqui: o repositório confere e grava atomicamente.
        self._users.update(updated, password_hash)
        if current.active and not updated.active:
            self._sessions.delete_for_user(updated.id)
        return updated
