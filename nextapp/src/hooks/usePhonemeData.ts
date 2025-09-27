import { useState, useCallback } from 'react';
import { extractPhonemeScores } from '../utils/parseAzure';

export interface PhonemeData {
  phonemeScores: { [key: string]: number };
  totalPhonemes: number;
  averageScore: number;
  lowScoringPhonemes: Array<{ phoneme: string; score: number }>;
}

export function usePhonemeData() {
  const [phonemeData, setPhonemeData] = useState<PhonemeData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const processAzureResponse = useCallback((azureResponse: any) => {
    setIsProcessing(true);
    
    try {
      const phonemeScores = extractPhonemeScores(azureResponse);
      const scores = Object.values(phonemeScores);
      const totalPhonemes = Object.keys(phonemeScores).length;
      const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      
      // Find phonemes with low scores (below 70%)
      const lowScoringPhonemes = Object.entries(phonemeScores)
        .filter(([_, score]) => score < 70)
        .map(([phoneme, score]) => ({ phoneme, score }))
        .sort((a, b) => a.score - b.score);

      const data: PhonemeData = {
        phonemeScores,
        totalPhonemes,
        averageScore,
        lowScoringPhonemes
      };

      setPhonemeData(data);
      return data;
    } catch (error) {
      console.error('Error processing phoneme data:', error);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const clearData = useCallback(() => {
    setPhonemeData(null);
  }, []);

  return {
    phonemeData,
    isProcessing,
    processAzureResponse,
    clearData
  };
}
