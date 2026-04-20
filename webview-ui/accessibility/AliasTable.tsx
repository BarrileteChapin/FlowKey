import React, { useState } from 'react';
import type { VoiceAlias, TileAction } from '../../src/types';
import './AliasTable.css';

interface AliasTableProps {
  aliases: VoiceAlias[];
  onSave: (alias: VoiceAlias) => void;
  onDelete: (aliasId: string) => void;
}

export function AliasTable({ aliases, onSave, onDelete }: AliasTableProps) {
  const [newPhrase, setNewPhrase] = useState('');
  const [newRef, setNewRef] = useState('');
  const [newType, setNewType] = useState<TileAction['type']>('command');

  const handleAdd = () => {
    if (!newPhrase.trim() || !newRef.trim()) return;
    const alias: VoiceAlias = {
      id: `alias-${Date.now()}`,
      phrase: newPhrase.trim().toLowerCase(),
      action: { type: newType, ref: newRef.trim() },
    };
    onSave(alias);
    setNewPhrase('');
    setNewRef('');
  };

  return (
    <div className="alias-table">
      <table role="table" aria-label="Voice alias table">
        <thead>
          <tr>
            <th>Phrase</th>
            <th>Type</th>
            <th>Action</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {aliases.map((a) => (
            <tr key={a.id}>
              <td>"{a.phrase}"</td>
              <td>{a.action.type}</td>
              <td className="alias-table__ref">{a.action.ref}</td>
              <td>
                <button
                  className="alias-table__delete"
                  onClick={() => onDelete(a.id)}
                  aria-label={`Delete alias "${a.phrase}"`}
                >
                  <i className="codicon codicon-trash" aria-hidden="true" />
                </button>
              </td>
            </tr>
          ))}
          {aliases.length === 0 && (
            <tr>
              <td colSpan={4} className="alias-table__empty">No voice aliases configured.</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="alias-table__add">
        <input
          type="text"
          placeholder="Phrase (e.g. run tests)"
          value={newPhrase}
          onChange={(e) => setNewPhrase(e.target.value)}
          aria-label="Voice phrase"
        />
        <select value={newType} onChange={(e) => setNewType(e.target.value as TileAction['type'])} aria-label="Action type">
          <option value="command">Command</option>
          <option value="flow">Flow</option>
          <option value="terminal">Terminal</option>
        </select>
        <input
          type="text"
          placeholder="Command ID or flow ID"
          value={newRef}
          onChange={(e) => setNewRef(e.target.value)}
          aria-label="Action reference"
        />
        <button className="alias-table__add-btn" onClick={handleAdd} aria-label="Add alias">
          <i className="codicon codicon-add" aria-hidden="true" /> Add
        </button>
      </div>
    </div>
  );
}
