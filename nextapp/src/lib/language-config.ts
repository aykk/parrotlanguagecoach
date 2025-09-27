export interface LanguageConfig {
  code: string
  name: string
  flag: string
  rtl: boolean
  phonemeComplexity: number
  commonDifficulties: string[]
  sampleSentences: string[]
  voiceSettings: {
    pitch: number
    rate: number
    volume: number
  }
}

export const SUPPORTED_LANGUAGES: Record<string, LanguageConfig> = {
  english: {
    code: "en-US",
    name: "English",
    flag: "🇺🇸",
    rtl: false,
    phonemeComplexity: 7,
    commonDifficulties: ["θ", "ð", "r", "l", "w", "v"],
    sampleSentences: [
      "The quick brown fox jumps over the lazy dog",
      "She sells seashells by the seashore",
      "How much wood would a woodchuck chuck if a woodchuck could chuck wood",
      "Peter Piper picked a peck of pickled peppers",
      "I thought a thought but the thought I thought wasn't the thought I thought I thought",
      "Red leather, yellow leather, red leather, yellow leather",
      "Unique New York, you know you need unique New York",
    ],
    voiceSettings: { pitch: 0.9, rate: 0.85, volume: 1 },
  },
  spanish: {
    code: "es-ES",
    name: "Spanish",
    flag: "🇪🇸",
    rtl: false,
    phonemeComplexity: 6,
    commonDifficulties: ["r", "rr", "ñ", "x", "β"],
    sampleSentences: [
      "El perro de San Roque no tiene rabo porque Ramón Ramírez se lo ha cortado",
      "Tres tristes tigres tragaban trigo en un trigal",
      "Como poco coco como, poco coco compro",
      "El cielo está enladrillado, quién lo desenladrillará",
      "Pablito clavó un clavito en la calva de un calvito",
      "Erre con erre cigarro, erre con erre barril",
      "Un tigre, dos tigres, tres tigres trigaban en un trigal",
    ],
    voiceSettings: { pitch: 0.95, rate: 0.8, volume: 1 },
  },
  french: {
    code: "fr-FR",
    name: "French",
    flag: "🇫🇷",
    rtl: false,
    phonemeComplexity: 8,
    commonDifficulties: ["r", "y", "œ", "ɛ̃", "ɔ̃", "ɑ̃"],
    sampleSentences: [
      "Les chaussettes de l'archiduchesse sont-elles sèches, archi-sèches",
      "Un chasseur sachant chasser sait chasser sans son chien",
      "Je veux et j'exige d'exquises excuses",
      "Seize jacinthes sèchent dans seize sachets sales",
      "Si six scies scient six cyprès, six cent six scies scient six cent six cyprès",
      "Didon dîna, dit-on, du dos d'un dodu dindon",
      "Cinq chiens chassent six chats",
    ],
    voiceSettings: { pitch: 0.92, rate: 0.82, volume: 1 },
  },
  german: {
    code: "de-DE",
    name: "German",
    flag: "🇩🇪",
    rtl: false,
    phonemeComplexity: 8,
    commonDifficulties: ["x", "ç", "ʁ", "ʏ", "œ", "ɛː"],
    sampleSentences: [
      "Fischers Fritz fischt frische Fische, frische Fische fischt Fischers Fritz",
      "Brautkleid bleibt Brautkleid und Blaukraut bleibt Blaukraut",
      "Der Cottbuser Postkutscher putzt den Cottbuser Postkutschkasten",
      "Zwischen zwei Zwetschgenzweigen sitzen zwei zwitschernde Schwalben",
      "Klitzekleine Kinder können keine kleinen Kirschkerne knacken",
      "Sieben Schneeschaufler schaufeln sieben Schaufeln Schnee",
    ],
    voiceSettings: { pitch: 0.88, rate: 0.8, volume: 1 },
  },
  italian: {
    code: "it-IT",
    name: "Italian",
    flag: "🇮🇹",
    rtl: false,
    phonemeComplexity: 6,
    commonDifficulties: ["r", "ʎ", "ɲ", "ts", "dz"],
    sampleSentences: [
      "Trentatré trentini entrarono a Trento, tutti e trentatré trotterellando",
      "Sopra la panca la capra campa, sotto la panca la capra crepa",
      "Se l'arcivescovo di Costantinopoli si disarcivescoviscostantinopolizzasse",
      "Chi ama chiama, chi non ama non chiama",
      "Tre tigri contro tre tigri",
      "Il cuoco cuoce in cucina e dice che la cucina cuoce",
    ],
    voiceSettings: { pitch: 0.93, rate: 0.85, volume: 1 },
  },
  portuguese: {
    code: "pt-BR",
    name: "Portuguese",
    flag: "🇧🇷",
    rtl: false,
    phonemeComplexity: 7,
    commonDifficulties: ["r", "ʁ", "ʎ", "ɲ", "ũ", "ĩ"],
    sampleSentences: [
      "O rato roeu a roupa do rei de Roma",
      "Três pratos de trigo para três tigres tristes",
      "A aranha arranha a jarra, a jarra arranha a aranha",
      "Sabia que o sabiá sabia assobiar",
      "O tempo perguntou pro tempo quanto tempo o tempo tem",
      "Num ninho de mafagafos, cinco mafagafinhos há",
    ],
    voiceSettings: { pitch: 0.94, rate: 0.83, volume: 1 },
  },
  japanese: {
    code: "ja-JP",
    name: "Japanese",
    flag: "🇯🇵",
    rtl: false,
    phonemeComplexity: 5,
    commonDifficulties: ["r", "l", "f", "v", "θ", "ð"],
    sampleSentences: [
      "赤巻紙青巻紙黄巻紙 (あかまきがみあおまきがみきまきがみ)",
      "生麦生米生卵 (なまむぎなまごめなまたまご)",
      "隣の客はよく柿食う客だ (となりのきゃくはよくかきくうきゃくだ)",
      "坊主が屏風に上手に坊主の絵を描いた (ぼうずがびょうぶにじょうずにぼうずのえをかいた)",
      "東京特許許可局 (とうきょうとっきょきょかきょく)",
    ],
    voiceSettings: { pitch: 1.0, rate: 0.75, volume: 1 },
  },
  mandarin: {
    code: "zh-CN",
    name: "Mandarin Chinese",
    flag: "🇨🇳",
    rtl: false,
    phonemeComplexity: 9,
    commonDifficulties: ["x", "q", "zh", "ch", "sh", "r"],
    sampleSentences: [
      "四是四，十是十，十四是十四，四十是四十",
      "吃葡萄不吐葡萄皮，不吃葡萄倒吐葡萄皮",
      "红鲤鱼与绿鲤鱼与驴",
      "黑化肥发灰，灰化肥发黑",
      "知之为知之，不知为不知，是知也",
    ],
    voiceSettings: { pitch: 0.96, rate: 0.78, volume: 1 },
  },
  arabic: {
    code: "ar-SA",
    name: "Arabic",
    flag: "🇸🇦",
    rtl: true,
    phonemeComplexity: 9,
    commonDifficulties: ["ʕ", "ħ", "χ", "ɣ", "q", "ʔ"],
    sampleSentences: [
      "خيط حرير على حائط خليل",
      "نقار الخشب ينقر خشب الخشخاش",
      "شارع شريف شاهين شارع شاسع",
      "قال القائل قولاً قليلاً",
      "جحا جاء جائعاً جداً",
    ],
    voiceSettings: { pitch: 0.9, rate: 0.8, volume: 1 },
  },
  russian: {
    code: "ru-RU",
    name: "Russian",
    flag: "🇷🇺",
    rtl: false,
    phonemeComplexity: 8,
    commonDifficulties: ["r", "ʲ", "x", "ʃ", "ʒ", "ts"],
    sampleSentences: [
      "Карл у Клары украл кораллы, а Клара у Карла украла кларнет",
      "Шла Саша по шоссе и сосала сушку",
      "Ехал грека через реку, видит грека - в реке рак",
      "На дворе трава, на траве дрова",
      "Корабли лавировали, лавировали, да не вылавировали",
    ],
    voiceSettings: { pitch: 0.87, rate: 0.82, volume: 1 },
  },
}

export function getLanguageConfig(languageCode: string): LanguageConfig {
  return SUPPORTED_LANGUAGES[languageCode] || SUPPORTED_LANGUAGES.english
}

export function getLanguageList(): Array<{ code: string; name: string; flag: string }> {
  return Object.entries(SUPPORTED_LANGUAGES).map(([code, config]) => ({
    code,
    name: config.name,
    flag: config.flag,
  }))
}

export function getRandomSentence(languageCode: string): string {
  const config = getLanguageConfig(languageCode)
  const sentences = config.sampleSentences
  return sentences[Math.floor(Math.random() * sentences.length)]
}

export function isRTLLanguage(languageCode: string): boolean {
  return getLanguageConfig(languageCode).rtl
}
