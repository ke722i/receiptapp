// src のカテゴリ表を Edge Function 用の場所へコピーする
//  Edge Function は supabase/functions の外のファイルを読めないため、同じ内容を置いている。
//  編集するのは src/constants/categoryData.js（Excel から生成）だけで、コピー先は直接直さない。
import { copyFileSync, mkdirSync } from 'node:fs';

const destDir = 'supabase/functions/_shared';
mkdirSync(destDir, { recursive: true });
copyFileSync('src/constants/categoryData.js', `${destDir}/categoryData.js`);
console.log(`copied categoryData.js to ${destDir}`);
