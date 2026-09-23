import {
  ConversationOrbFallback,
  type ConversationOrbProps,
} from './ConversationOrbFallback';

export { ConversationOrbFallback };
export type { ConversationOrbProps };

export function ConversationOrb(props: ConversationOrbProps) {
  return <ConversationOrbFallback {...props} />;
}
