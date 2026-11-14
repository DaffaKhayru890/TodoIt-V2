from __future__ import annotations

from tests.conftest import authenticate
from tests.factories import add_member, create_user, create_workspace


async def test_tag_crud_flow(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await db_session.commit()
    authenticate(api_app, owner)

    created = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/tags",
        json={"name": "  backend  "},
    )
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "backend"

    second = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/tags",
        json={"name": "frontend"},
    )
    assert second.status_code == 201

    listed = await api_client.get(f"/api/v1/workspaces/{workspace.id}/tags")
    assert listed.status_code == 200
    assert [item["name"] for item in listed.json()] == ["backend", "frontend"]

    detail = await api_client.get(f"/api/v1/tags/{body['id']}")
    assert detail.status_code == 200
    assert detail.json()["name"] == "backend"

    updated = await api_client.patch(
        f"/api/v1/tags/{body['id']}",
        json={"name": "platform"},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "platform"

    deleted = await api_client.delete(f"/api/v1/tags/{body['id']}")
    assert deleted.status_code == 204

    after = await api_client.get(f"/api/v1/tags/{body['id']}")
    assert after.status_code == 404


async def test_tag_validation_and_duplicates(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await db_session.commit()
    authenticate(api_app, owner)

    blank = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/tags",
        json={"name": "   "},
    )
    assert blank.status_code == 422
    assert blank.json()["detail"] == "INVALID_TAG_NAME"

    first = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/tags",
        json={"name": "backend"},
    )
    duplicate = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/tags",
        json={"name": "backend"},
    )
    second = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/tags",
        json={"name": "frontend"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "TAG_ALREADY_EXISTS"

    tag_id = first.json()["id"]
    blank_update = await api_client.patch(f"/api/v1/tags/{tag_id}", json={"name": "  "})
    duplicate_update = await api_client.patch(
        f"/api/v1/tags/{tag_id}",
        json={"name": second.json()["name"]},
    )
    missing_update = await api_client.patch(
        "/api/v1/tags/00000000-0000-0000-0000-000000000000",
        json={"name": "missing"},
    )
    missing_delete = await api_client.delete("/api/v1/tags/00000000-0000-0000-0000-000000000000")

    assert blank_update.status_code == 422
    assert duplicate_update.status_code == 409
    assert missing_update.status_code == 404
    assert missing_delete.status_code == 404


async def test_tag_permissions(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    member = await create_user(db_session)
    outsider = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await add_member(db_session, workspace=workspace, user=member, role="member")
    await db_session.commit()

    authenticate(api_app, outsider)
    denied_create = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/tags",
        json={"name": "backend"},
    )
    denied_list = await api_client.get(f"/api/v1/workspaces/{workspace.id}/tags")
    assert denied_create.status_code == 403
    assert denied_list.status_code == 403

    authenticate(api_app, owner)
    created = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/tags",
        json={"name": "backend"},
    )
    tag_id = created.json()["id"]

    authenticate(api_app, member)
    member_create = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/tags",
        json={"name": "frontend"},
    )
    assert member_create.status_code == 201
    denied_update = await api_client.patch(f"/api/v1/tags/{tag_id}", json={"name": "platform"})
    denied_delete = await api_client.delete(f"/api/v1/tags/{tag_id}")
    assert denied_update.status_code == 403
    assert denied_delete.status_code == 403


async def test_label_crud_flow(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await db_session.commit()
    authenticate(api_app, owner)

    created = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/labels",
        json={"name": "  urgent  ", "color": "#FF0000"},
    )
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "urgent"
    assert body["color"] == "#FF0000"

    second = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/labels",
        json={"name": "later"},
    )
    assert second.status_code == 201
    assert second.json()["color"] == "#6B7280"

    listed = await api_client.get(f"/api/v1/workspaces/{workspace.id}/labels")
    assert listed.status_code == 200
    assert [item["name"] for item in listed.json()] == ["later", "urgent"]

    detail = await api_client.get(f"/api/v1/labels/{body['id']}")
    assert detail.status_code == 200

    updated = await api_client.patch(
        f"/api/v1/labels/{body['id']}",
        json={"name": "critical", "color": "#00FF00"},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "critical"
    assert updated.json()["color"] == "#00FF00"

    deleted = await api_client.delete(f"/api/v1/labels/{body['id']}")
    assert deleted.status_code == 204

    after = await api_client.get(f"/api/v1/labels/{body['id']}")
    assert after.status_code == 404


async def test_label_validation_and_duplicates(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await db_session.commit()
    authenticate(api_app, owner)

    blank = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/labels",
        json={"name": "   ", "color": "#FF0000"},
    )
    bad_color = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/labels",
        json={"name": "urgent", "color": "1234567"},
    )
    short_color = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/labels",
        json={"name": "urgent", "color": "#FFF"},
    )
    assert blank.status_code == 422
    assert blank.json()["detail"] == "INVALID_LABEL_NAME"
    assert bad_color.status_code == 422
    assert bad_color.json()["detail"] == "INVALID_LABEL_COLOR"
    assert short_color.status_code == 422

    first = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/labels",
        json={"name": "urgent", "color": "#FF0000"},
    )
    duplicate = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/labels",
        json={"name": "urgent", "color": "#00FF00"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "LABEL_ALREADY_EXISTS"

    label_id = first.json()["id"]
    blank_update = await api_client.patch(
        f"/api/v1/labels/{label_id}",
        json={"name": "  "},
    )
    bad_color_update = await api_client.patch(
        f"/api/v1/labels/{label_id}",
        json={"color": "green"},
    )
    missing_update = await api_client.patch(
        "/api/v1/labels/00000000-0000-0000-0000-000000000000",
        json={"name": "missing"},
    )
    missing_delete = await api_client.delete("/api/v1/labels/00000000-0000-0000-0000-000000000000")

    assert blank_update.status_code == 422
    assert bad_color_update.status_code == 422
    assert missing_update.status_code == 404
    assert missing_delete.status_code == 404


async def test_label_permissions(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    member = await create_user(db_session)
    outsider = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await add_member(db_session, workspace=workspace, user=member, role="member")
    await db_session.commit()

    authenticate(api_app, outsider)
    denied = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/labels",
        json={"name": "urgent", "color": "#FF0000"},
    )
    assert denied.status_code == 403

    authenticate(api_app, owner)
    created = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/labels",
        json={"name": "urgent", "color": "#FF0000"},
    )
    label_id = created.json()["id"]

    authenticate(api_app, member)
    denied_update = await api_client.patch(
        f"/api/v1/labels/{label_id}",
        json={"name": "critical"},
    )
    denied_delete = await api_client.delete(f"/api/v1/labels/{label_id}")
    assert denied_update.status_code == 403
    assert denied_delete.status_code == 403
