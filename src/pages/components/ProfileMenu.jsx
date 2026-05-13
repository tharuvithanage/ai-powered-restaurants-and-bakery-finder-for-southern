import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Heart, LogOut, Settings } from "../../components/icons/Lucide";

export default function ProfileMenu({
  userName,
  avatarUrl,
  userInitials,
  avatarBroken,
  onAvatarBroken,
  onOpenProfile,
  onGoFavorites,
  onGoAdminPanel,
  onLogout,
  showAdminPanel,
  adminLabel = "Admin Panel",
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      const target = event.target;
      if (menuRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleAction = (fn) => {
    setOpen(false);
    fn?.();
  };

  return (
    <div className="profile-menu">
      <div className="profile-trigger-group">
        <button type="button" className="profile-link" onClick={onOpenProfile}>
          {avatarUrl && !avatarBroken ? (
            <img
              src={avatarUrl}
              alt=""
              className="profile-avatar"
              onError={onAvatarBroken}
            />
          ) : (
            <span className="profile-avatar profile-avatar-fallback" aria-hidden="true">
              {userInitials}
            </span>
          )}
          <span className="profile-name" title={userName}>
            {userName}
          </span>
        </button>
        <button
          ref={buttonRef}
          type="button"
          className="profile-trigger"
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Open menu"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
        >
          <ChevronDown className="profile-chevron" size={18} />
        </button>
      </div>

      {open ? (
        <div ref={menuRef} id={menuId} role="menu" className="profile-dropdown">
          <button
            type="button"
            className="profile-item"
            role="menuitem"
            onClick={() => handleAction(onGoFavorites)}
          >
            <Heart className="profile-item-icon" size={18} />
            <span>Favorites</span>
          </button>
          {showAdminPanel ? (
            <button
              type="button"
              className="profile-item"
              role="menuitem"
              onClick={() => handleAction(onGoAdminPanel)}
            >
              <Settings className="profile-item-icon" size={18} />
              <span>{adminLabel}</span>
            </button>
          ) : null}
          <div className="profile-sep" role="separator" />
          <button
            type="button"
            className="profile-item danger"
            role="menuitem"
            onClick={() => handleAction(onLogout)}
          >
            <LogOut className="profile-item-icon" size={18} />
            <span>Logout</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
