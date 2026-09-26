// Permissão de escrita nas páginas Catálogo e Tabelas (TASK-042; ADR-017 § 1: ADMIN edita, Operador
// só vê). PROVISÓRIO: devolve sempre `true` enquanto o hook de permissões da TASK-040 não existe nesta
// base. Na integração, troque o corpo pelo hook real (ex.: `return usePermissions().canEdit`) ou
// apague este arquivo e importe o hook da TASK-040 em `CatalogRoute` e `TablesRoute`. As páginas só
// recebem `canEdit` por prop e não mudam.

export function useCanEdit(): boolean {
  return true
}
