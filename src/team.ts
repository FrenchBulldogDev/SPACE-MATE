export type ProfileAsset = {
  id: string;
  /** Ruta pública como /team/nombre.webp. Usa null para mostrar el placeholder. */
  photo: string | null;
};

export const TEAM_MEMBER_ASSETS: ProfileAsset[] = [
  { id: 'member-1', photo: null },
  { id: 'member-2', photo: null },
  { id: 'member-3', photo: null },
];

export const COLLABORATOR_ASSETS: ProfileAsset[] = [
  { id: 'collaborator-1', photo: null },
  { id: 'collaborator-2', photo: null },
  { id: 'collaborator-3', photo: null },
];
