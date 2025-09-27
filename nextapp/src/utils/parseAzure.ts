export function extractPhonemeScores(jsonData: any) {
  const scores: { [phoneme: string]: number[] } = {};

  // Go through all words in the top NBest result
  jsonData.NBest[0].Words.forEach((word: any) => {
    if (!word.Phonemes) return;

    word.Phonemes.forEach((p: any) => {
      const phoneme = p.Phoneme;
      const score = p.PronunciationAssessment?.AccuracyScore ?? null;

      if (score !== null) {
        if (!scores[phoneme]) scores[phoneme] = [];
        scores[phoneme].push(score);
      }
    });
  });

  // average scores across occurrences
  const averagedScores: { [phoneme: string]: number } = {};
  for (const [phoneme, values] of Object.entries(scores)) {
    averagedScores[phoneme] =
      values.reduce((a, b) => a + b, 0) / values.length;
  }

  return averagedScores;
}
