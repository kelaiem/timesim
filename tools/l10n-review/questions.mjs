// The questions a native reviewer is asked first, per locale — tools/l10n-review-packets.mjs
// reads this. Each locale's rows come from its own landing's record in docs/BUILT.md (the
// "No native review pass" bullet names the terms a workshop is likely to dispute), or, where
// that record named none, from a scan of the locale's tables for one part spelled two ways.
// An empty list is a DECLARATION that nothing was recorded; a locale missing from QUESTIONS
// fails the builder, so a new LOCALES row cannot ship without someone deciding its questions.
// `term` must occur in the locale's translated strings: the builder fails a question whose
// term the tables no longer use, because a question about a word the page dropped is stale.

// The part names every section leans on, asked of every locale — English chrome keys.
export const CORE = ['Fusee & great wheel', 'Escape wheel', 'Pallet fork', 'Balance', 'Hairspring', 'Mainspring drum', 'Chain', 'Maintaining detent', 'Set-up work', 'Keyless works', 'Setting lever', 'Yoke', 'Motion works', 'Power reserve', 'Three-quarter plate', 'Alarm governor', 'Alarm crown'];

export const QUESTIONS = {
  tr: [
    { term: 'saat makinesi', en: 'movement', q: 'Is «saat makinesi» what a Turkish workshop calls the movement? «mekanizma» and «kalibre» are also heard.' },
    { term: 'kurma kolu', en: 'crown', q: '«kurma kolu» reads as "winding crown". The ALARM crown («Alarm kurma kolu») sets the alarm rather than winding anything. Does it need a different word?' },
    { term: 'fusee', en: 'fusee', q: 'The loan «fusee» is kept because no Turkish word exists for the part. Is there a trade term?' },
    { term: 'kavrama', en: 'clutch / gear mesh', q: '«kavrama» names both the clutch and a gear mesh. The keyless prose writes «dişli kavraması» for the mesh. Is that enough to tell them apart?' },
    { term: 'Çapa', en: 'pallet fork / governor anchor', q: '«Çapa» is the pallet fork, and «çapası» also names the alarm governor\'s anchor. Is one word right for both parts?' },
  ],
  nl: [
    { term: 'snek', en: 'fusee', q: 'Is «snek» the word a Dutch workshop uses for the fusee?' },
    { term: 'loopbehoud', en: 'maintaining power', q: 'Is «loopbehoud» the usual term for maintaining power?' },
    { term: 'regulateur', en: 'alarm governor', q: 'Is «regulateur» right for the alarm\'s air-brake governor, or does it suggest a regulator in the timekeeping sense?' },
    { term: 'anker', en: 'pallet fork / governor anchor', q: '«anker» names both the escapement\'s pallet fork and the alarm governor\'s anchor. Each entry\'s context separates them; does that read clearly?' },
  ],
  ko: [
    { term: '팔레트 포크', en: 'pallet fork', q: 'The tables use the enthusiast trade\'s loanwords. A watchmaker trained on the older Sino-Korean vocabulary may prefer other terms. Is «팔레트 포크» right here?' },
    { term: '밸런스', en: 'balance', q: 'Is the loanword «밸런스» right for the balance, or would a workshop use a Sino-Korean term?' },
    { term: '헤어스프링', en: 'hairspring', q: 'Is «헤어스프링» the word you would expect for the hairspring?' },
    { term: '포스 휠', en: 'fourth wheel', q: '«센터 휠 · 서드 휠 · 포스 휠» transliterate the train\'s wheels, and «포스» can also read as "force". Is that a problem?' },
    { term: '윤열', en: 'gear train', q: 'The train is «윤열», an older Sino-Korean word, beside loanwords elsewhere. Is the mixed register acceptable?' },
  ],
  de: [], fr: [], zh: [],
  es: [
    { term: 'esfera', en: 'dial', q: 'The tables use Spain\'s punctuation with pan-Hispanic vocabulary. A Mexican reader says «carátula» where the page says «esfera». Is «esfera» the right choice?' },
    { term: 'regulador', en: 'alarm governor', q: 'The alarm\'s air-brake governor is «Regulador del despertador». Does «regulador» suggest the timekeeping regulator instead?' },
    { term: 'remontuar', en: 'keyless works', q: 'Is «Mecanismo de remontuar» the term your readers would use for the keyless works (the crown-and-stem winding and setting mechanism)?' },
  ],
  ru: [
    { term: 'спираль', en: 'hairspring', q: 'The register is the industry\'s. Is «спираль» right for the hairspring, or would readers expect «волосок»?' },
    { term: 'баланс', en: 'balance', q: 'Is «баланс» the word you would use for the balance?' },
    { term: 'платин', en: 'plate / platinum', q: '«платина» is both the movement\'s plate and the metal platinum; the alloy menu is what tells them apart. Does that read clearly?' },
  ],
  pt: [
    { term: 'balanço', en: 'balance', q: 'The register is Brazilian. A reader in Portugal says «volante» where the page says «balanço». Is that acceptable, or should the page choose differently?' },
    { term: 'embreagem', en: 'clutch', q: 'The page writes the Brazilian «embreagem»; Portugal writes «embraiagem». Is the Brazilian form right for your readers?' },
    { term: 'platina', en: 'plate / platinum', q: '«platina» is both the movement\'s plate and the metal platinum; the alloy menu is what tells them apart. Does that read clearly?' },
  ],
  it: [
    { term: 'conoide', en: 'fusee', q: '«conoide» is the Italian literature\'s word for the fusee. Would your readers know it, or expect «fusée»?' },
    { term: 'cerchio', en: 'rim', q: 'The page writes «cerchio» where the trade sometimes says «serto». Which is right here?' },
    { term: 'Carica', en: 'Wind / Load', q: '«Carica» is both "Wind" (dare la carica) and "Load" (loading a saved state), in different parts of the panel. Is the double meaning a problem?' },
  ],
  vi: [
    { term: 'càng neo', en: 'pallet fork', q: 'The glossary was built by translators, not a Vietnamese watchmaker. Is «càng neo» right for the pallet fork, or is «càng cua» more usual?' },
    { term: 'bánh lắc', en: 'balance', q: 'Is «bánh lắc» right for the balance, or «bánh xe cân bằng»?' },
    { term: 'fusee', en: 'fusee', q: 'The page keeps the loan «fusee». Does the part want a native word?' },
  ],
  id: [
    { term: 'balans', en: 'balance', q: 'Are «balans» and «jangkar» the words an Indonesian workshop uses for the balance and the pallet fork?' },
    { term: 'fusee', en: 'fusee', q: '«fusee» is kept as a loan because no Indonesian word exists for the part. Is there a trade term?' },
    { term: 'eskapemen', en: 'escapement', q: 'The page writes «eskapemen». Some writers keep the English «escapement». Which reads better?' },
  ],
  cy: [
    { term: 'mantol', en: 'balance', q: 'Is «mantol», from the word for scales, right for the balance?' },
    { term: 'dihangfa', en: 'escapement', q: '«dihangfa» is a plain compound for the escapement, where the trade may keep the English. Which would readers expect?' },
    { term: 'fforch baled', en: 'pallet fork', q: 'Is «fforch baled» right for the pallet fork?' },
    { term: 'sbring', en: 'spring', q: 'The page writes «sbring» throughout; a purist might write «sbrin». Which is right?' },
    { term: 'bys', en: 'hand / finger', q: '«bys» is both a clock hand and a mechanical finger. Each finger is qualified («bys tawelu»), but readers meet the same word the glossary gives the hands. Does that confuse?' },
    { term: 'fodelu', en: 'modelled (mutated)', q: 'Mutation is what a machine draft most often gets subtly wrong. Please watch for wrong soft, nasal or aspirate mutations anywhere, for example «wedi\'i fodelu», «yr orsaf».' },
  ],
  lv: [
    { term: 'fuzeja', en: 'fusee', q: 'The fusee is «fuzeja», a declinable loan (fuzejas, fuzeju), where other locales keep «fusee» unchanged. Is there a Latvian trade word, and if not, is the adapted loan right?' },
    { term: 'eskapement', en: 'escapement', q: 'The escapement is the loan «eskapements». Would a Latvian workshop say that, or a native term?' },
    { term: 'spirāle', en: 'hairspring', q: 'The hairspring is «spirāle» (balansa spirāle), which is also the everyday word for any spiral; the mainspring\'s own spiral is written «tinums» to keep them apart. Is «spirāle» what a workshop says?' },
    { term: 'enkura dakša', en: 'pallet fork', q: 'Is «enkura dakša» right for the pallet fork?' },
    { term: 'zobratiņ', en: 'pinion', q: 'A pinion is «zobratiņš», the mechanical-engineering word (rack and pinion). Is that what a watchmaker calls a pinion?' },
    { term: 'aizturis', en: 'click / maintaining detent', q: '«aizturis» is the click AND the maintaining detent, against «sprūds» for a driving pawl and «fiksators» for a detent spring. Do the three read as distinct parts?' },
  ],
  hi: [
    { term: 'पैलेट फोर्क', en: 'part names', q: 'Part names are transliterated loanwords («पैलेट फोर्क», «हेयरस्प्रिंग», «बैलेंस व्हील»), as Hindi engineering prose usually writes them. Is that the right side of the register split for these terms?' },
    { term: 'बलाघूर्ण', en: 'torque', q: 'Physical quantities use the standard scientific words («बलाघूर्ण» for torque, «जड़त्व» for inertia, «आयाम» for amplitude). Do they read naturally beside the loanword part names?' },
    { term: 'चाबी', en: 'wind', q: 'Winding is «चाबी भरें». Is that the natural phrase?' },
  ],
  he: [
    { term: 'פיוזי', en: 'fusee', q: '«פיוזי» is a transliteration for a part with no Hebrew word. Is there a term a workshop would use?' },
    { term: 'עוגן', en: 'pallet fork', q: '«עוגן» is the pallet fork, and is also the escapement\'s whole name in common use («מילוט עוגן»). Does that read clearly?' },
    { term: 'גלגלון', en: 'pinion', q: 'Is «גלגלון» right for the pinion, or «גלגל שיניים קטן»?' },
    { term: '←', en: 'flow arrows', q: 'Chains of parts are written with arrows, pointed right-to-left so they follow the reading direction. Please confirm that the chains read naturally.' },
  ],
  fa: [
    { term: 'موتور', en: 'movement', q: 'Is «موتور» what an Iranian workshop calls the movement? «کالیبر» is also heard.' },
    { term: 'فوزه', en: 'fusee', q: '«فوزه» is a transliteration for a part with no Persian word. Is there a trade term?' },
    { term: 'گریز', en: 'escapement', q: 'Is «گریز» right for the escapement, or would readers expect the loanword «اسکپمنت»?' },
    { term: '←', en: 'flow arrows', q: 'Chains of parts are written with arrows, pointed right-to-left so they follow the reading direction. Please confirm that the chains read naturally.' },
  ],
  ar: [
    { term: 'الفيوزي', en: 'fusee', q: 'There is no Arabic word for the fusee, so the page transliterates it as «الفيوزي». Is there a term a workshop would use instead?' },
    { term: 'حاكم', en: 'alarm governor', q: 'The alarm\'s air-brake governor is «حاكم المنبه». Does «حاكم» read naturally for a speed governor, or would «منظم السرعة» or another term be clearer?' },
    { term: 'شوكة الميزان', en: 'pallet fork', q: 'The tables use Modern Standard Arabic engineering vocabulary. A watchmaker in Cairo or Casablanca may use other words. Is «شوكة الميزان» right for the pallet fork, and «عجلة التوازن» for the balance?' },
    { term: 'مثبِّت الإبقاء', en: 'maintaining detent', q: 'Is «مثبِّت الإبقاء» understandable as the maintaining-power detent, the part that keeps the watch running while it is wound?' },
    { term: '←', en: 'flow arrows', q: 'Chains of parts are written with arrows, such as «الضاغط ← الكلاّب ← عجلة الأعمدة». In this review 47 arrows were turned to point right-to-left so they follow the reading direction. Please confirm that the chains now read naturally.' },
  ],
  ja: [
    { term: 'フュジー', en: 'fusee', q: 'The fusee is «フュジー» in 37 places and «フュゼ» in 3. Which spelling should the page use?' },
    { term: '竜頭', en: 'crown', q: 'The crown is «りゅうず» in 59 places and «竜頭» in 4. Which should the page use?' },
    { term: '逆転防止つめ', en: 'maintaining detent', q: 'The maintaining-power detent is labelled «逆転防止つめ» ("anti-reverse click"). Does that read as the maintaining detent, or would a watchmaker take it for the barrel\'s click?' },
    { term: '巻真まわり', en: 'keyless works', q: 'Is «巻真まわり» the right name for the keyless works (the crown-and-stem winding and setting mechanism)?' },
  ],
  'zh-Hant': [
    { term: '上鏈', en: 'winding', q: 'The table writes «上鏈» for winding throughout; it was unified on that spelling because most rows already used it. Taiwan commonly writes «上鍊» (自動上鍊), and «鏈» is also the chain («芝麻鏈», «鏈條»). Which should winding be for your readers?' },
    { term: '寶塔輪', en: 'fusee', q: 'Is «寶塔輪» the term a workshop uses for the fusee? Simplified Chinese writes «芝麻链塔轮».' },
    { term: '錶冠', en: 'crown', q: 'Is «錶冠» right for the crown, or would readers expect «龍頭»?' },
    { term: '芝麻鏈', en: 'fusee chain', q: 'Is «芝麻鏈» the usual name for the fusee chain?' },
  ],
};

