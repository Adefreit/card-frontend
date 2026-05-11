import { useAdminUserDetailContext } from "./AdminUserDetailContext";

export default function AdminUserPermissionsTab() {
  const {
    permissions,
    commonPermissions,
    permissionInput,
    currentUserId,
    targetUserId,
    isGrantPending,
    isRevokePending,
    onPermissionInputChange,
    onGrantPermission,
    onRevokePermission,
  } = useAdminUserDetailContext();

  return (
    <div className="admin-stack admin-tab-panel">
      <div className="admin-inline-form admin-inline-form--spaced">
        <input
          list="permission-suggestions"
          value={permissionInput}
          onChange={(event) => onPermissionInputChange(event.target.value)}
          placeholder="Permission e.g. ADMIN"
        />
        <datalist id="permission-suggestions">
          {commonPermissions.map((permission) => (
            <option key={permission} value={permission} />
          ))}
        </datalist>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            const trimmed = permissionInput.trim().toUpperCase();
            if (!trimmed) {
              return;
            }

            onGrantPermission(trimmed);
          }}
          disabled={isGrantPending}
        >
          {isGrantPending ? "Granting..." : "Grant"}
        </button>
      </div>

      <div className="admin-table-wrap" style={{ marginTop: 16 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Permission</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {permissions.length === 0 ? (
              <tr>
                <td
                  colSpan={2}
                  style={{
                    color: "var(--ui-muted)",
                    textAlign: "center",
                  }}
                >
                  No permissions assigned
                </td>
              </tr>
            ) : (
              permissions.map((permission) => {
                const isSelfAdminRemovalBlocked =
                  permission.toUpperCase() === "ADMIN" &&
                  currentUserId === targetUserId;

                return (
                  <tr key={permission}>
                    <td>
                      <strong>{permission}</strong>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary btn-xs"
                        onClick={() => onRevokePermission(permission)}
                        disabled={isRevokePending || isSelfAdminRemovalBlocked}
                        title={
                          isSelfAdminRemovalBlocked
                            ? "Cannot remove your own ADMIN permission"
                            : undefined
                        }
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
