from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.services.workspaces.models import WorkspaceInvitation
from tests.conftest import authenticate
from tests.factories import add_member, create_user, create_workspace


async def _create_workspace_via_api(api_client, name: str = "Product Team") -> dict:
    response = await api_client.post(
        "/api/v1/workspaces",
        json={"name": name, "description": "  A shared workspace  "},
    )
    assert response.status_code == 201
    return response.json()


async def test_create_and_list_workspaces(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    await db_session.commit()
    authenticate(api_app, owner)

    created = await _create_workspace_via_api(api_client)

    assert created["name"] == "Product Team"
    assert created["description"] == "A shared workspace"
    assert created["owner_id"] == str(owner.id)
    assert created["is_archived"] is False

    listed = await api_client.get("/api/v1/workspaces")
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [created["id"]]

    legacy = await api_client.get("/workspaces")
    assert legacy.status_code == 200
    assert legacy.json()[0]["id"] == created["id"]


async def test_blank_workspace_name_is_rejected(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.post("/api/v1/workspaces", json={"name": "   "})

    assert response.status_code == 422
    assert response.json()["detail"] == "Workspace name is required"


async def test_get_workspace_permissions_and_archived(
    api_app,
    api_client,
    db_session,
) -> None:
    owner = await create_user(db_session)
    outsider = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    archived = await create_workspace(db_session, owner=owner, is_archived=True)
    await db_session.commit()

    authenticate(api_app, owner)
    ok = await api_client.get(f"/api/v1/workspaces/{workspace.id}")
    missing = await api_client.get("/api/v1/workspaces/00000000-0000-0000-0000-000000000000")
    archived_response = await api_client.get(f"/api/v1/workspaces/{archived.id}")
    legacy = await api_client.get(f"/workspaces/{workspace.id}")

    assert ok.status_code == 200
    assert ok.json()["id"] == str(workspace.id)
    assert missing.status_code == 404
    assert archived_response.status_code == 404
    assert legacy.status_code == 200

    authenticate(api_app, outsider)
    forbidden = await api_client.get(f"/api/v1/workspaces/{workspace.id}")
    assert forbidden.status_code == 403
    assert forbidden.json()["detail"] == "WORKSPACE_ACCESS_DENIED"


async def test_update_workspace_rules(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    member_user = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await add_member(db_session, workspace=workspace, user=member_user, role="member")
    await db_session.commit()

    authenticate(api_app, owner)
    updated = await api_client.patch(
        f"/api/v1/workspaces/{workspace.id}",
        json={"name": "  Renamed  ", "description": "   "},
    )
    blank = await api_client.patch(
        f"/api/v1/workspaces/{workspace.id}",
        json={"name": "   "},
    )
    legacy = await api_client.patch(
        f"/workspaces/{workspace.id}",
        json={"description": "Legacy description"},
    )

    assert updated.status_code == 200
    assert updated.json()["name"] == "Renamed"
    assert updated.json()["description"] is None
    assert blank.status_code == 422
    assert legacy.status_code == 200
    assert legacy.json()["description"] == "Legacy description"

    authenticate(api_app, member_user)
    denied = await api_client.patch(
        f"/api/v1/workspaces/{workspace.id}",
        json={"name": "Nope"},
    )
    assert denied.status_code == 403
    assert denied.json()["detail"] == "INSUFFICIENT_PERMISSION"


async def test_archive_workspace_requires_owner(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    admin = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await add_member(db_session, workspace=workspace, user=admin, role="admin")
    await db_session.commit()

    authenticate(api_app, admin)
    denied = await api_client.delete(f"/api/v1/workspaces/{workspace.id}")
    assert denied.status_code == 403

    authenticate(api_app, owner)
    archived = await api_client.delete(f"/api/v1/workspaces/{workspace.id}")
    assert archived.status_code == 204

    listed = await api_client.get("/api/v1/workspaces")
    assert listed.json() == []


async def test_list_members_includes_profile(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session, email="owner@example.com", full_name="Owner Name")
    member = await create_user(db_session, email="member@example.com", full_name="Member Name")
    workspace = await create_workspace(db_session, owner=owner)
    await add_member(db_session, workspace=workspace, user=member, role="member")
    await db_session.commit()
    authenticate(api_app, owner)

    response = await api_client.get(f"/api/v1/workspaces/{workspace.id}/members")

    assert response.status_code == 200
    roles = {item["user_email"]: item["role"] for item in response.json()}
    assert roles == {"owner@example.com": "owner", "member@example.com": "member"}
    assert all(item["full_name"] for item in response.json())

    legacy = await api_client.get(f"/workspaces/{workspace.id}/members")
    assert legacy.status_code == 200


async def test_update_member_role_rules(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    admin = await create_user(db_session)
    member = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await add_member(db_session, workspace=workspace, user=admin, role="admin")
    await add_member(db_session, workspace=workspace, user=member, role="member")
    await db_session.commit()

    authenticate(api_app, owner)
    promoted = await api_client.patch(
        f"/api/v1/workspaces/{workspace.id}/members/{member.id}",
        json={"role": "admin"},
    )
    invalid = await api_client.patch(
        f"/api/v1/workspaces/{workspace.id}/members/{member.id}",
        json={"role": "owner"},
    )
    protected = await api_client.patch(
        f"/api/v1/workspaces/{workspace.id}/members/{owner.id}",
        json={"role": "member"},
    )
    missing = await api_client.patch(
        "/api/v1/workspaces/00000000-0000-0000-0000-000000000000/members/"
        "00000000-0000-0000-0000-000000000001",
        json={"role": "member"},
    )

    assert promoted.status_code == 200
    assert promoted.json()["role"] == "admin"
    assert invalid.status_code == 422
    assert invalid.json()["detail"] == "INVALID_ROLE"
    assert protected.status_code == 403
    assert protected.json()["detail"] == "OWNER_ROLE_IS_PROTECTED"
    assert missing.status_code == 404

    authenticate(api_app, admin)
    admin_update = await api_client.patch(
        f"/api/v1/workspaces/{workspace.id}/members/{member.id}",
        json={"role": "member"},
    )
    assert admin_update.status_code == 200
    assert admin_update.json()["role"] == "member"


async def test_remove_member_rules(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    admin = await create_user(db_session)
    member = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await add_member(db_session, workspace=workspace, user=admin, role="admin")
    await add_member(db_session, workspace=workspace, user=member, role="member")
    await db_session.commit()

    authenticate(api_app, owner)
    owner_protected = await api_client.delete(
        f"/api/v1/workspaces/{workspace.id}/members/{owner.id}"
    )
    removed = await api_client.delete(f"/api/v1/workspaces/{workspace.id}/members/{member.id}")
    missing = await api_client.delete(f"/api/v1/workspaces/{workspace.id}/members/{member.id}")

    assert owner_protected.status_code == 403
    assert owner_protected.json()["detail"] == "OWNER_CANNOT_BE_REMOVED"
    assert removed.status_code == 204
    assert missing.status_code == 404

    authenticate(api_app, admin)
    self_remove = await api_client.delete(f"/api/v1/workspaces/{workspace.id}/members/{admin.id}")
    assert self_remove.status_code == 403
    assert self_remove.json()["detail"] == "INSUFFICIENT_PERMISSION"


async def test_invitation_create_list_and_revoke(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    existing = await create_user(db_session, email="existing@example.com")
    workspace = await create_workspace(db_session, owner=owner)
    await add_member(db_session, workspace=workspace, user=existing, role="member")
    await db_session.commit()

    authenticate(api_app, owner)
    created = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/invitations",
        json={"email": "Invitee@Example.com", "role": "member"},
    )
    duplicate = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/invitations",
        json={"email": "invitee@example.com", "role": "member"},
    )
    already_member = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/invitations",
        json={"email": "existing@example.com", "role": "member"},
    )
    invalid_role = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/invitations",
        json={"email": "other@example.com", "role": "owner"},
    )

    assert created.status_code == 200
    body = created.json()
    assert body["email"] == "invitee@example.com"
    assert body["status"] == "pending"
    assert body["token"]
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "INVITATION_EXISTS"
    assert already_member.status_code == 409
    assert already_member.json()["detail"] == "USER_ALREADY_MEMBER"
    assert invalid_role.status_code == 422

    listed = await api_client.get(f"/api/v1/workspaces/{workspace.id}/invitations")
    assert listed.status_code == 200
    assert listed.json()[0]["token"] is None

    legacy_list = await api_client.get(f"/workspaces/{workspace.id}/invitations")
    assert legacy_list.status_code == 200

    revoked = await api_client.delete(f"/api/v1/workspaces/{workspace.id}/invitations/{body['id']}")
    revoked_again = await api_client.delete(
        f"/api/v1/workspaces/{workspace.id}/invitations/{body['id']}"
    )
    missing = await api_client.delete(
        f"/api/v1/workspaces/{workspace.id}/invitations/00000000-0000-0000-0000-000000000000"
    )

    assert revoked.status_code == 204
    assert revoked_again.status_code == 204
    assert missing.status_code == 404


async def test_invitation_creation_requires_admin(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    member = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await add_member(db_session, workspace=workspace, user=member, role="member")
    await db_session.commit()
    authenticate(api_app, member)

    response = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/invitations",
        json={"email": "invitee@example.com", "role": "member"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "INSUFFICIENT_PERMISSION"


async def test_accept_invitation_flow(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    invitee = await create_user(db_session, email="invitee@example.com")
    wrong_user = await create_user(db_session, email="wrong@example.com")
    workspace = await create_workspace(db_session, owner=owner)
    await db_session.commit()

    authenticate(api_app, owner)
    created = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/invitations",
        json={"email": "invitee@example.com", "role": "admin"},
    )
    token = created.json()["token"]

    authenticate(api_app, wrong_user)
    mismatch = await api_client.post(
        "/api/v1/invitations/accept",
        json={"token": token},
    )
    assert mismatch.status_code == 403
    assert mismatch.json()["detail"] == "INVITATION_EMAIL_MISMATCH"

    authenticate(api_app, invitee)
    accepted = await api_client.post("/api/v1/invitations/accept", json={"token": token})
    assert accepted.status_code == 200
    body = accepted.json()
    assert body["workspace_id"] == str(workspace.id)
    assert body["role"] == "admin"
    assert body["member"]["user_email"] == "invitee@example.com"

    repeated = await api_client.post("/api/v1/invitations/accept", json={"token": token})
    assert repeated.status_code == 409
    assert repeated.json()["detail"] == "INVITATION_NOT_ACTIVE"


async def test_accept_invitation_rejects_unknown_and_expired(
    api_app,
    api_client,
    db_session,
) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    invitee = await create_user(db_session, email="invitee@example.com")
    workspace = await create_workspace(db_session, owner=owner)
    await db_session.commit()

    authenticate(api_app, owner)
    created = await api_client.post(
        f"/api/v1/workspaces/{workspace.id}/invitations",
        json={"email": "invitee@example.com", "role": "member"},
    )
    token = created.json()["token"]

    result = await db_session.execute(
        select(WorkspaceInvitation).where(WorkspaceInvitation.email == "invitee@example.com")
    )
    invitation = result.scalar_one()
    invitation.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    await db_session.commit()

    authenticate(api_app, invitee)
    unknown = await api_client.post("/api/v1/invitations/accept", json={"token": "missing"})
    expired = await api_client.post("/api/v1/invitations/accept", json={"token": token})

    assert unknown.status_code == 404
    assert expired.status_code == 400
    assert expired.json()["detail"] == "INVITATION_EXPIRED"


async def test_legacy_workspace_endpoints(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner=owner)
    await db_session.commit()
    authenticate(api_app, owner)

    created = await api_client.post("/workspaces", json={"name": "Legacy"})
    assert created.status_code == 201

    patched = await api_client.patch(
        f"/workspaces/{workspace.id}",
        json={"name": "Legacy Renamed"},
    )
    assert patched.status_code == 200
    assert patched.json()["name"] == "Legacy Renamed"

    archived = await api_client.delete(f"/workspaces/{created.json()['id']}")
    assert archived.status_code == 204


async def test_legacy_invitation_endpoints(api_app, api_client, db_session) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    invitee = await create_user(db_session, email="invitee@example.com")
    workspace = await create_workspace(db_session, owner=owner)
    await db_session.commit()

    authenticate(api_app, owner)
    created = await api_client.post(
        f"/workspaces/{workspace.id}/invitations",
        json={"email": "invitee@example.com", "role": "member"},
    )
    assert created.status_code == 200
    token = created.json()["token"]

    authenticate(api_app, invitee)
    accepted = await api_client.post("/invitations/accept", json={"token": token})
    assert accepted.status_code == 200
    assert accepted.json()["workspace_id"] == str(workspace.id)
