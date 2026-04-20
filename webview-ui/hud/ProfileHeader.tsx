import React from 'react';
import type { Profile } from '../../src/types';
import './ProfileHeader.css';

interface ProfileHeaderProps {
  activeProfile: Profile;
  profiles: Profile[];
  onSwitch: (profileId: string) => void;
}

export function ProfileHeader({ activeProfile, profiles, onSwitch }: ProfileHeaderProps) {
  return (
    <div className="profile-header">
      <div className="profile-header__info">
        <span className="profile-header__indicator" aria-hidden="true" />
        <span className="profile-header__name">{activeProfile.name}</span>
        {activeProfile.trigger !== 'manual' && (
          <span className="profile-header__auto-badge">Auto</span>
        )}
      </div>
      <select
        className="profile-header__select"
        value={activeProfile.id}
        onChange={(e) => onSwitch(e.target.value)}
        aria-label="Switch profile"
      >
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
