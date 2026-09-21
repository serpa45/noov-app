import { useEffect, useRef } from "react";

interface NavigationStep {
  instruction: string;
  distance: string;
  modifier?: string;
  type?: string;
}

/**
 * Text-to-Speech hook for turn-by-turn navigation.
 * Speaks the current instruction when it changes.
 * Repeats when the driver is within ~100m of the turn.
 */
export const useNavigationTTS = (
  steps: NavigationStep[] | undefined,
  enabled: boolean
) => {
  const lastSpoken = useRef<string>("");
  const lastRepeat = useRef<string>("");
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      synthRef.current?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!enabled || !steps || steps.length === 0 || !synthRef.current) return;

    const currentStep = steps[0];
    if (!currentStep) return;

    const instruction = currentStep.instruction;
    const distText = currentStep.distance;

    // Parse distance in meters
    const distMeters = distText.includes("km")
      ? parseFloat(distText) * 1000
      : parseInt(distText.replace(/\D/g, "")) || 999;

    // Speak new instruction when it changes
    if (instruction !== lastSpoken.current) {
      lastSpoken.current = instruction;
      lastRepeat.current = "";
      speak(`${instruction}, em ${distText}`);
    }
    // Repeat when close to the turn (< 100m)
    else if (distMeters < 100 && instruction !== lastRepeat.current) {
      lastRepeat.current = instruction;
      speak(`Agora, ${instruction}`);
    }
  }, [steps, enabled]);

  const speak = (text: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 1.05;
    utterance.pitch = 1;
    utterance.volume = 1;
    synthRef.current.speak(utterance);
  };
};
