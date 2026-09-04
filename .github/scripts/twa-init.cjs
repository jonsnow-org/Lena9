// يُشغَّل داخل GitHub Actions فقط (انظر .github/workflows/build-apk.yml) —
// يبني مشروع أندرويد TWA برمجياً بدل تشغيل "bubblewrap init" التفاعلي
// (الذي يطرح أسئلة يستحيل الرد عليها آلياً). يقرأ بيانات التطبيق مباشرة
// من public/manifest.json المنشور فعلياً على الموقع الحي، ثم يفرض عليها
// اسم الحزمة والاسم المطابقين تماماً لما هو منشور بالفعل في
// public/.well-known/assetlinks.json — أي عدم تطابق هنا يعني رجوع نفس
// مشكلة "يفتح كمتصفح" اللي حُلَّت سابقاً.
const path = require('path');
const {TwaManifest, TwaGenerator, ConsoleLog} = require('@bubblewrap/core');
const {generateManifestChecksumFile} = require('@bubblewrap/cli/dist/lib/cmds/shared');

const PACKAGE_ID = 'studio.ai.literium.twa';
const HOST = 'literium-wjct.onrender.com';
const MANIFEST_URL = `https://${HOST}/manifest.json`;

async function main() {
  const targetDirectory = process.cwd();

  const twaManifest = await TwaManifest.fromWebManifest(MANIFEST_URL);

  twaManifest.packageId = PACKAGE_ID;
  twaManifest.host = HOST;
  twaManifest.startUrl = '/';
  twaManifest.name = 'Literium';
  twaManifest.launcherName = 'Literium';
  twaManifest.appVersionCode = Number(process.env.APP_VERSION_CODE || 2);
  twaManifest.appVersionName = process.env.APP_VERSION_NAME || '1.0.1';
  // نفس ملف التوقيع الأصلي الذي طُلبت بصمته بالضبط في assetlinks.json —
  // يُستعاد من سر GitHub قبل هذه الخطوة، لا يُنشأ مفتاح جديد أبداً.
  twaManifest.signingKey.path = path.join(targetDirectory, 'android.keystore');
  twaManifest.signingKey.alias = 'literium';

  const manifestFile = path.join(targetDirectory, 'twa-manifest.json');
  await twaManifest.saveToFile(manifestFile);

  const twaGenerator = new TwaGenerator();
  const log = new ConsoleLog('twa-init');
  await twaGenerator.createTwaProject(targetDirectory, twaManifest, log);
  await generateManifestChecksumFile(manifestFile, targetDirectory);

  console.log('TWA project scaffolded at', targetDirectory);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
