'use client';

import { useState } from 'react';
import type { PresenceUser } from '@/hooks/useCanvasPresence';

// =============================================================================
// Types
// =============================================================================

interface PresenceAvatarsProps {
  /** List of users currently in the canvas */
  members: PresenceUser[];
  /** Current user ID to exclude from display */
  currentUserId?: string;
  /** Maximum avatars to show before "+N" */
  maxVisible?: number;
  /** Size of avatars */
  size?: 'sm' | 'md' | 'lg';
  /** Show connection status indicator */
  showStatus?: boolean;
  /** Whether connected to presence service */
  isConnected?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getInitials(username?: string, userId?: string): string {
  if (username) {
    const parts = username.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return username.slice(0, 2).toUpperCase();
  }
  return userId?.slice(0, 2).toUpperCase() || '??';
}

function getSizeClasses(size: 'sm' | 'md' | 'lg') {
  switch (size) {
    case 'sm':
      return { avatar: 'w-7 h-7 text-xs', overlap: '-ml-2' };
    case 'md':
      return { avatar: 'w-9 h-9 text-sm', overlap: '-ml-3' };
    case 'lg':
      return { avatar: 'w-11 h-11 text-base', overlap: '-ml-4' };
  }
}

// =============================================================================
// Components
// =============================================================================

interface AvatarProps {
  user: PresenceUser;
  size: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

function Avatar({ user, size, showTooltip = true }: AvatarProps) {
  const [showDetails, setShowDetails] = useState(false);
  const sizeClasses = getSizeClasses(size);
  const initials = getInitials(user.username, user.user_id);

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      {/* Avatar */}
      <div
        className={`${sizeClasses.avatar} rounded-full flex items-center justify-center font-medium text-white ring-2 ring-slate-800 cursor-default transition-transform hover:scale-110 hover:z-10`}
        style={{ backgroundColor: user.color || '#6366f1' }}
      >
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.username || 'User'}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      {/* Online indicator */}
      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full ring-2 ring-slate-800" />

      {/* Tooltip */}
      {showTooltip && showDetails && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-700 text-white text-xs rounded shadow-lg whitespace-nowrap z-50">
          {user.username || `User ${user.user_id.slice(0, 8)}`}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-700" />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function PresenceAvatars({
  members,
  currentUserId,
  maxVisible = 5,
  size = 'md',
  showStatus = true,
  isConnected = false,
}: PresenceAvatarsProps) {
  const sizeClasses = getSizeClasses(size);

  // Filter out current user
  const otherMembers = currentUserId
    ? members.filter((m) => m.user_id !== currentUserId)
    : members;

  // Split into visible and overflow
  const visibleMembers = otherMembers.slice(0, maxVisible);
  const overflowCount = otherMembers.length - maxVisible;

  // Only show component if there are other members OR we're connected (to show "Live")
  if (otherMembers.length === 0 && (!showStatus || !isConnected)) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      {/* Connection status - only show when connected (Live) */}
      {showStatus && isConnected && (
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-slate-400">Live</span>
        </div>
      )}

      {/* Avatars */}
      {otherMembers.length > 0 && (
        <div className="flex items-center">
          {visibleMembers.map((member, index) => (
            <div
              key={member.user_id}
              className={index > 0 ? sizeClasses.overlap : ''}
              style={{ zIndex: visibleMembers.length - index }}
            >
              <Avatar user={member} size={size} />
            </div>
          ))}

          {/* Overflow indicator */}
          {overflowCount > 0 && (
            <div
              className={`${sizeClasses.avatar} ${sizeClasses.overlap} rounded-full flex items-center justify-center font-medium bg-slate-600 text-slate-200 ring-2 ring-slate-800`}
              style={{ zIndex: 0 }}
            >
              +{overflowCount}
            </div>
          )}
        </div>
      )}

      {/* User count */}
      {otherMembers.length > 0 && (
        <span className="text-xs text-slate-400">
          {otherMembers.length} {otherMembers.length === 1 ? 'viewer' : 'viewers'}
        </span>
      )}
    </div>
  );
}

// =============================================================================
// Cursor Overlay Component (for showing other users' cursors on canvas)
// =============================================================================

interface CursorOverlayProps {
  members: PresenceUser[];
  currentUserId?: string;
  /** Scale factor for cursor positions (e.g., if canvas is zoomed) */
  scale?: number;
}

export function CursorOverlay({
  members,
  currentUserId,
  scale = 1,
}: CursorOverlayProps) {
  // Filter to members with cursor positions, excluding current user
  const cursors = members.filter(
    (m) => m.cursor && m.user_id !== currentUserId
  );

  if (cursors.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
      {cursors.map((member) => (
        <div
          key={member.user_id}
          className="absolute transition-all duration-75 ease-out"
          style={{
            left: (member.cursor!.x * scale),
            top: (member.cursor!.y * scale),
          }}
        >
          {/* Cursor pointer */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="drop-shadow-md"
          >
            <path
              d="M5.65376 12.4563L10.5 19.5L12.5 15.5L17.5 14L5.65376 12.4563Z"
              fill={member.color || '#6366f1'}
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Name label */}
          <div
            className="absolute left-4 top-4 px-1.5 py-0.5 rounded text-xs text-white whitespace-nowrap"
            style={{ backgroundColor: member.color || '#6366f1' }}
          >
            {member.username || `User ${member.user_id.slice(0, 8)}`}
          </div>
        </div>
      ))}
    </div>
  );
}

export default PresenceAvatars;
