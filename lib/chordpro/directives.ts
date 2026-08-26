// Short aliases accepted on parse; long form is always emitted (docs/DOMAIN.md §1).
export const DIRECTIVE_ALIASES: Record<string, string> = {
  sov: 'start_of_verse',
  eov: 'end_of_verse',
  soc: 'start_of_chorus',
  eoc: 'end_of_chorus',
  c: 'comment',
};

export const SECTION_START: Record<string, 'verse' | 'chorus' | 'bridge'> = {
  start_of_verse: 'verse',
  start_of_chorus: 'chorus',
  start_of_bridge: 'bridge',
};

export const SECTION_END: Record<string, 'verse' | 'chorus' | 'bridge'> = {
  end_of_verse: 'verse',
  end_of_chorus: 'chorus',
  end_of_bridge: 'bridge',
};

export function canonicalDirectiveName(name: string): string {
  return DIRECTIVE_ALIASES[name] ?? name;
}
