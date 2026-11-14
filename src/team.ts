export type ProfileAsset = {
  id: string;
  /** URL de la foto importada. Usa null para mostrar el placeholder. */
  photo: string | null;
};

export const TEAM_MEMBER_ASSETS: ProfileAsset[] = [
  { id: 'member-1', photo: priscilaPhoto },
  { id: 'member-2', photo: martinPhoto },
  { id: 'member-3', photo: joaquinPhoto },
];

export const COLLABORATOR_ASSETS: ProfileAsset[] = [
  { id: 'collaborator-1', photo: guadalupePhoto },
  { id: 'collaborator-2', photo: lucianoPhoto },
  { id: 'collaborator-3', photo: candelaPhoto },
];

import joaquinPhoto from '../Assets/Joaquín López_ Photo.png';
import priscilaPhoto from '../Assets/Priscila López_Photo.jpg';
import martinPhoto from '../Assets/Krzyszkowski Martín_photo.jpeg';
import guadalupePhoto from '../Assets/Guadalupe Aguirre.jpeg';
import lucianoPhoto from '../Assets/Luciano Biudes.jpeg';
import candelaPhoto from '../Assets/Candela Conti.jpeg';

