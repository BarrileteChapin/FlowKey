export interface TileAction {
  type: 'command' | 'flow' | 'terminal';
  ref: string;
  args?: unknown[];
}

export interface Tile {
  id: string;
  label: string;
  icon: string;
  action: TileAction;
  category?: string;
  options?: string[];
}

export interface LayoutConfig {
  gridCols: number;
  gridRows: number;
  density: 'compact' | 'comfortable' | 'spacious';
  tileShape: 'grid' | 'octagon';
}

export type ProfileTrigger = 'manual' | 'onDebug' | 'onGit' | 'onTestFile' | 'custom';

export interface Profile {
  id: string;
  name: string;
  isBuiltIn: boolean;
  trigger: ProfileTrigger;
  accentColor: string;
  tiles: Tile[];
  layoutConfig: LayoutConfig;
}

export interface FlowNode {
  id: string;
  type: 'command' | 'terminal' | 'condition' | 'notification' | 'delay';
  data: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourcePort?: string;
  targetPort?: string;
  label?: string;
}

export interface Flow {
  id: string;
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  confirmedTerminalOnce: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface GestureBinding {
  gestureId: string;
  label: string;
  points: Point[];
  action: TileAction;
}

export interface GestureReference {
  id: string;
  label: string;
  points: Point[];
}

export interface WorkspacePack {
  version: '1.0';
  name: string;
  profiles: Profile[];
  flows: Flow[];
  gestureBindings: GestureBinding[];
  exportedAt: string;
}

export interface HudMessage {
  command: 'executeTile' | 'switchProfile' | 'dock' | 'resize' | 'getState' | 'toggleHud';
  payload: Record<string, string | number | boolean>;
}

export interface HudState {
  activeProfileId: string;
  profiles: Profile[];
  settings: HudSettings;
}

export interface HudSettings {
  gridCols: number;
  gridRows: number;
  density: 'compact' | 'comfortable' | 'spacious';
  transparency: number;
  tileShape: 'grid' | 'octagon';
  dockPosition: 'float' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export interface MessageValidationResult {
  valid: boolean;
  error?: string;
}

// --- Flow Editor Messages ---

export interface FlowEditorMessage {
  command:
    | 'saveFlow'
    | 'deleteFlow'
    | 'runFlow'
    | 'dryRunFlow'
    | 'getFlows'
    | 'getFlow'
    | 'getWhitelistedCommands'
    | 'bindFlowToTile'
    | 'openSettings'
    | 'loadExampleFlows'
    | 'closeFlowEditor';
  payload: Record<string, unknown>;
}

export interface FlowEditorState {
  flows: Flow[];
  activeFlowId: string | null;
  profiles: Profile[];
}

// --- Accessibility Messages ---

export interface AccessibilityMessage {
  command:
    | 'recogniseGesture'
    | 'saveGestureBinding'
    | 'deleteGestureBinding'
    | 'getGestureBindings'
    | 'saveVoiceAlias'
    | 'deleteVoiceAlias'
    | 'getVoiceAliases'
    | 'startListening'
    | 'stopListening';
  payload: Record<string, unknown>;
}

export interface VoiceAlias {
  id: string;
  phrase: string;
  action: TileAction;
}

export interface AccessibilityState {
  gestureBindings: GestureBinding[];
  builtInGestures: GestureReference[];
  profiles: Profile[];
  voiceAliases: VoiceAlias[];
  voiceEnabled: boolean;
  isListening: boolean;
}
