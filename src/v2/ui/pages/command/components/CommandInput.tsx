import { motion } from "framer-motion";
import { Send, Wand2, Mic, MicOff, Volume2, VolumeX } from "lucide-react";

interface CommandInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onVoiceToggle: () => void;
  onVolumeMute: () => void;
  inputFocused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  voiceSpeaking: boolean;
  voiceListening: boolean;
  voiceSupported: boolean;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function CommandInput({
  input,
  onInputChange,
  onSend,
  onVoiceToggle,
  onVolumeMute,
  inputFocused,
  onFocus,
  onBlur,
  voiceSpeaking,
  voiceListening,
  voiceSupported,
  onKeyDown,
}: CommandInputProps) {
  return (
    <div className="px-8 pb-20 pt-2">
      <div className="max-w-xl mx-auto">
        <motion.div
          animate={{
            boxShadow: inputFocused
              ? "0 0 0 1px hsl(210 100% 66% / 0.24), 0 0 60px hsl(210 100% 66% / 0.12)"
              : "0 0 0 1px hsl(0 0% 100% / 0.1)",
          }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-3 rounded-2xl px-4 py-3"
          style={{
            background: "hsl(240 5% 6% / 0.75)",
            backdropFilter: "blur(40px)",
            border: "1px solid hsl(0 0% 100% / 0.1)",
          }}
        >
          <motion.button
            onClick={onVolumeMute}
            whileTap={{ scale: 0.9 }}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-500 flex-shrink-0 ${
              voiceSpeaking
                ? "bg-[hsl(270_60%_60%)]/15 text-[hsl(270_60%_70%)]"
                : "text-muted-foreground/100 hover:text-foreground/100"
            }`}
            title="Lettura vocale"
          >
            {voiceSpeaking ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </motion.button>
          <motion.button
            onClick={onVoiceToggle}
            whileTap={{ scale: 0.9 }}
            disabled={!voiceSupported}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-500 flex-shrink-0 ${
              voiceListening
                ? "bg-primary/20 text-primary animate-pulse"
                : "text-muted-foreground/100 hover:text-foreground/100"
            } ${!voiceSupported ? "opacity-30 cursor-not-allowed" : ""}`}
            title={
              voiceSupported
                ? voiceListening
                  ? "Stop registrazione"
                  : "Registrazione vocale"
                : "Voce non supportata da questo browser"
            }
          >
            {voiceListening ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </motion.button>
          <input
            type="text"
            placeholder="Scrivi un obiettivo..."
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            onBlur={onBlur}
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground/80 font-light text-foreground/100"
          />
          <motion.button
            onClick={() => {}}
            whileTap={{ scale: 0.9 }}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-500 flex-shrink-0 text-[hsl(270_60%_70%)] hover:bg-[hsl(270_60%_60%)]/10"
            title="Suggerimento AI"
          >
            <Wand2 className="w-4 h-4" />
          </motion.button>
          <motion.button
            onClick={onSend}
            disabled={!input.trim()}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10 text-primary/92 hover:bg-primary/15 hover:text-primary/96 transition-all duration-500 disabled:opacity-20"
          >
            <Send className="w-3.5 h-3.5" />
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
