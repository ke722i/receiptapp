import tomato from '../assets/avatars/tomato.svg';
import milk from '../assets/avatars/milk.svg';
import onigiri from '../assets/avatars/onigiri.svg';
import carrot from '../assets/avatars/carrot.svg';
import bread from '../assets/avatars/bread.svg';

/*
 * ユーザーアイコン（用意された画像から選ぶ。任意の画像のアップロードはできない）
 *  ・選んだ画像の id だけを、アカウントの情報（Supabase Auth の user_metadata.avatar）に保存する
 *  ・画像を足す・変えるときは、src/assets/avatars/ に SVG を置いて、ここに足す（id は保存済みの値なので、変えない）
 */
export const AVATARS = [
  { id: 'tomato', label: 'トマト', src: tomato },
  { id: 'milk', label: '牛乳', src: milk },
  { id: 'onigiri', label: 'おにぎり', src: onigiri },
  { id: 'carrot', label: 'にんじん', src: carrot },
  { id: 'bread', label: '食パン', src: bread },
];

/** id から画像を探す。無ければ（まだ選んでいない・不明な id）undefined */
export const findAvatar = (id) => AVATARS.find((a) => a.id === id);
