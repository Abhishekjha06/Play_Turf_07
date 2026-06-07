import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function useSmartBack(fallback = "/") {
  const navigate = useNavigate();
  return () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(fallback);
  };
}

export function BackButton({ onClick, label }: { onClick?: () => void; label?: string }) {
  const back = useSmartBack();
  return (
    <button
      onClick={onClick ?? back}
      className="h-10 w-10 rounded-full glass grid place-items-center pressable"
      aria-label="Back"
      data-testid="back-button"
    >
      <ArrowLeft className="h-5 w-5" />
      <span className="sr-only">{label ?? "Back"}</span>
    </button>
  );
}
