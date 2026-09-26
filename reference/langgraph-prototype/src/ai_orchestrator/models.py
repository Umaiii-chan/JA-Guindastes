from collections.abc import Callable
from typing import Any, Protocol, cast

from langchain.chat_models import init_chat_model


class Model(Protocol):
    def invoke(self, messages: Any) -> object: ...


def default_model_factory(identifier: str) -> Model:
    return cast(Model, init_chat_model(identifier, temperature=0))


ModelFactory = Callable[[str], Model]


def text_from_response(response: object) -> str:
    content = getattr(response, "content", response)
    if isinstance(content, str):
        return content
    return str(content)
