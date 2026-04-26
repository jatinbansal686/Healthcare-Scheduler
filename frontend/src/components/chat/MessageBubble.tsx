// // ============================================================
// // MessageBubble.tsx — Single chat message with sender styling
// // ============================================================

// import React from 'react';
// import type { ChatMessage } from '../../types';

// interface MessageBubbleProps {
//   message: ChatMessage;
// }

// function formatTime(iso: string): string {
//   try {
//     return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
//   } catch {
//     return '';
//   }
// }

// export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
//   console.log('[MessageBubble] render', { id: message.id, sender: message.sender });

//   const isUser = message.sender === 'user';

//   return (
//     <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
//       {/* Agent avatar */}
//       {!isUser && (
//         <div className="mr-2 flex-shrink-0 h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-sm font-bold">
//           AI
//         </div>
//       )}

//       <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
//         <div
//           className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
//             isUser
//               ? 'bg-teal-600 text-white rounded-tr-sm'
//               : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
//           }`}
//         >
//           {/* Render newlines as line breaks */}
//           {message.text.split('\n').map((line, i) => (
//             <React.Fragment key={i}>
//               {line}
//               {i < message.text.split('\n').length - 1 && <br />}
//             </React.Fragment>
//           ))}
//         </div>

//         <span className="text-xs text-slate-400 px-1">
//           {formatTime(message.timestamp)}
//         </span>
//       </div>

//       {/* User avatar */}
//       {isUser && (
//         <div className="ml-2 flex-shrink-0 h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-sm font-bold">
//           You
//         </div>
//       )}
//     </div>
//   );
// };

// ============================================================
// MessageBubble.tsx — Single chat message with sender styling
// OCP: Extended to render SlotCards for slot messages.
//      All existing text-bubble behaviour unchanged.
// ============================================================

import React from "react";
import type { ChatMessage, AvailableSlot } from "../../types/agent.types";
import { SlotCards } from "./SlotCards";
import { stripSlotLines } from "../../lib/slotParser";

interface MessageBubbleProps {
  message: ChatMessage;
  onSlotSelect?: (slot: AvailableSlot) => void;
  isLoading?: boolean;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function renderText(text: string) {
  return text.split("\n").map((line, i, arr) => (
    <React.Fragment key={i}>
      {line}
      {i < arr.length - 1 && <br />}
    </React.Fragment>
  ));
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onSlotSelect,
  isLoading = false,
}) => {
  console.log("[MessageBubble] render", {
    id: message.id,
    sender: message.sender,
    hasSlots: !!message.slots?.length,
    slotCount: message.slots?.length ?? 0,
  });

  const isUser = message.sender === "user";
  const hasSlots = !isUser && !!message.slots && message.slots.length > 0;

  // When slots are present, strip the bullet list from the text so we
  // don't duplicate the slot lines — they're shown as cards instead.
  const displayText = hasSlots ? stripSlotLines(message.text) : message.text;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      {/* Agent avatar */}
      {!isUser && (
        <div className="mr-2 flex-shrink-0 h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-sm font-bold">
          AI
        </div>
      )}

      <div
        className={`${
          // Wider max-width when showing cards so they have room to breathe
          hasSlots ? "max-w-[90%] sm:max-w-[85%]" : "max-w-[75%]"
        } ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}
      >
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed w-full ${
            isUser
              ? "bg-teal-600 text-white rounded-tr-sm"
              : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"
          }`}
        >
          {/* Main text — slots stripped if cards shown below */}
          {displayText && renderText(displayText)}

          {/* Slot cards — only for agent messages with parsed slots */}
          {hasSlots && onSlotSelect && (
            <SlotCards
              slots={message.slots!}
              onSelect={onSlotSelect}
              disabled={isLoading}
            />
          )}
        </div>

        <span className="text-xs text-slate-400 px-1">
          {formatTime(message.timestamp)}
        </span>
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="ml-2 flex-shrink-0 h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-sm font-bold">
          You
        </div>
      )}
    </div>
  );
};
