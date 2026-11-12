from __future__ import annotations


def test_create_app_configuration() -> None:
    from app.main import create_app

    app = create_app()
    assert app.title == "TodoIt V2 API"
    assert app.docs_url is not None
    assert app.root_path == ""
