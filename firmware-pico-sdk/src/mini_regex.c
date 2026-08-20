// Mini-silnik regex z grupami przechwytujacymi - podzbior zgodny z tym,
// co dopuszcza walidator konfiguracji (CircuitPythonowe ure bez {m,n}):
//   ^ $ . [abc] [^abc] [a-z] * + ? ( ) oraz klasy \d \w \s (i negacje \D \W \S).
// Backtracking rekurencyjny z limitem krokow (ochrona przed z³oœliwym wzorcem).
#include "mini_regex.h"

#include <string.h>

#define MAX_STEPS 100000

typedef struct {
  const char *pat_end;
  const char *text_begin;
  const char *text_end;
  mr_match_t *m;
  int steps;
} ctx_t;

static int match_here(ctx_t *c, const char *pat, const char *text);

static int class_matches(const char **pp, char ch, int consumed_ok) {
  // *pp wskazuje na poczatek elementu klasy; zwraca -1 gdy koniec ']'
  const char *p = *pp;
  int neg = 0;
  (void)consumed_ok;
  if (*p == '^') { neg = 1; p++; }
  int hit = 0;
  while (*p && *p != ']') {
    char lo = *p;
    if (lo == '\\' && p[1]) { // klasa w klasie: \d itd.
      p++;
      char k = *p++;
      int sub = 0;
      if (k == 'd') sub = (ch >= '0' && ch <= '9');
      else if (k == 'w') sub = (ch == '_' || (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9'));
      else if (k == 's') sub = (ch == ' ' || ch == '\t' || ch == '\r' || ch == '\n');
      else sub = (ch == k);
      hit |= sub;
      continue;
    }
    p++;
    if (*p == '-' && p[1] && p[1] != ']') {
      char hi = p[1];
      p += 2;
      hit |= (ch >= lo && ch <= hi);
    } else {
      hit |= (ch == lo);
    }
  }
  if (*p == ']') p++;
  *pp = p;
  return neg ? !hit : hit;
}

static int single_matches(ctx_t *c, const char *pat, char ch, const char **pat_next) {
  (void)c;
  const char *p = pat;
  int ok;
  if (*p == '.') {
    ok = (ch != '\0');
    p++;
  } else if (*p == '[') {
    p++;
    ok = class_matches(&p, ch, 1);
  } else if (*p == '\\' && p[1]) {
    char k = p[1];
    p += 2;
    if (k == 'd') ok = (ch >= '0' && ch <= '9');
    else if (k == 'D') ok = !(ch >= '0' && ch <= '9');
    else if (k == 'w') ok = (ch == '_' || (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9'));
    else if (k == 'W') ok = !(ch == '_' || (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9'));
    else if (k == 's') ok = (ch == ' ' || ch == '\t' || ch == '\r' || ch == '\n');
    else if (k == 'S') ok = !(ch == ' ' || ch == '\t' || ch == '\r' || ch == '\n');
    else ok = (ch == k);
  } else {
    ok = (ch == *p);
    p++;
  }
  *pat_next = p;
  return ok && ch != '\0';
}

// znajdz koniec elementu (pojedynczy atom bez kwantyfikatora)
static const char *atom_end(const char *pat) {
  if (*pat == '[') {
    const char *p = pat + 1;
    if (*p == '^') p++;
    if (*p == ']') p++;  // ']' jako pierwszy znak klasy = literal
    while (*p && *p != ']') {
      if (*p == '\\' && p[1]) p++;
      p++;
    }
    return (*p == ']') ? p + 1 : p;
  }
  if (*pat == '\\' && pat[1]) return pat + 2;
  return pat + 1;
}

static int match_quant(ctx_t *c, const char *atom, const char *rest, char quant,
                       const char *text) {
  if (++c->steps > MAX_STEPS) return 0;
  if (quant == '*' || quant == '+') {
    int min = (quant == '+') ? 1 : 0;
    // zachlannie: najpierw policz maks. dopasowan
    const char *t = text;
    int count = 0;
    const char *dummy;
    while (t < c->text_end && single_matches(c, atom, *t, &dummy)) { t++; count++; }
    for (; count >= min; count--) {
      if (match_here(c, rest, text + count)) return 1;
      if (++c->steps > MAX_STEPS) return 0;
    }
    return 0;
  }
  if (quant == '?') {
    const char *dummy;
    if (text < c->text_end && single_matches(c, atom, *text, &dummy)) {
      if (match_here(c, rest, text + 1)) return 1;
    }
    return match_here(c, rest, text);
  }
  return 0;
}

static int match_here(ctx_t *c, const char *pat, const char *text) {
  if (++c->steps > MAX_STEPS) return 0;
  if (pat >= c->pat_end || *pat == '\0') {
    c->m->end = (int)(text - c->text_begin);
    return 1;
  }
  if (*pat == '$' && (pat + 1 >= c->pat_end || pat[1] == '\0')) {
    if (text == c->text_end) {
      c->m->end = (int)(text - c->text_begin);
      return 1;
    }
    return 0;
  }
  if (*pat == '(') {
    // znajdz pasujacy ')'
    int depth = 1;
    const char *p = pat + 1;
    while (*p && depth) {
      if (*p == '\\' && p[1]) p += 2;
      else {
        if (*p == '(') depth++;
        if (*p == ')') depth--;
        p++;
      }
    }
    if (depth) return 0;  // niedomknieta grupa
    const char *close = p - 1;      // pozycja ')'
    char quant = (*p == '*' || *p == '+' || *p == '?') ? *p : 0;
    if (quant == '*' || quant == '+') return 0;  // niewspierane na grupie
    int gi = c->m->group_count;
    if (gi >= MR_MAX_GROUPS) return 0;
    c->m->group_count++;
    c->m->groups[gi].start = (int)(text - c->text_begin);
    // dopasuj wnetrze grupy jako prefiks, potem reszte
    // strategia: probuj kolejne dlugosci przez rekurencje wnetrza
    // uproszczenie: wnetrze grupy sklejamy z resztą wzorca przez marker
    // -> realizacja: tymczasowo dopasuj wnetrze + reszta jako kontynuacja
    {
      // zbuduj: match wnetrza tak, ze po wyjsciu z ')' kontynuujemy match_here(rest)
      // implementacja przez lokalna kopie patternu nie jest potrzebna:
      // wykonujemy match rekursywnie na wnetrzu z wlasnym "kontynuatorem".
      // Trik: podmieniamy pat_end na close i wolamy match_here na wnetrzu;
      // sukces wnetrza konczy sie w dowolnym miejscu tekstu -> potrzebujemy
      // wszystkich mozliwych koncow. Prosciej: brute-force dlugosci grupy.
      for (const char *split = c->text_end; split >= text; split--) {
        // czy wnetrze dopasowuje DOKLADNIE text..split?
        ctx_t inner = *c;
        mr_match_t im = *c->m;
        inner.m = &im;
        inner.pat_end = close;
        inner.text_end = split;
        im.end = -1;
        if (match_here(&inner, pat + 1, text) && im.end == (int)(split - c->text_begin)) {
          c->m->group_count = im.group_count;  // zagniezdzone grupy z wnetrza
          c->m->groups[gi].start = (int)(text - c->text_begin);
          c->m->groups[gi].end = (int)(split - c->text_begin);
          ctx_t after = *c;
          after.steps = inner.steps;
          const char *rest = quant ? close + 2 : close + 1;
          if (match_here(&after, rest, split)) {
            c->steps = after.steps;
            return 1;
          }
          c->steps = inner.steps;
          // cofnij grupy dodane przez to podejscie
          c->m->group_count = gi + 1;
        }
        if (++c->steps > MAX_STEPS) return 0;
      }
      c->m->group_count = gi;  // pelny odwrot
      if (quant == '?') {
        // wariant bez grupy: grupa nieuzyta, ale wciaz zliczona (jak w re)
        c->m->group_count = gi + 1;
        c->m->groups[gi].start = c->m->groups[gi].end = -1;
        if (match_here(c, close + 2, text)) return 1;
        c->m->group_count = gi;
      }
      return 0;
    }
  }
  const char *next = atom_end(pat);
  char quant = (*next == '*' || *next == '+' || *next == '?') ? *next : 0;
  if (quant) return match_quant(c, pat, next + 1, quant, text);
  const char *dummy;
  if (text < c->text_end && single_matches(c, pat, *text, &dummy)) {
    return match_here(c, next, text + 1);
  }
  return 0;
}

int mr_match(const char *pattern, const char *text, mr_match_t *m) {
  memset(m, 0, sizeof(*m));
  for (int i = 0; i < MR_MAX_GROUPS; i++) m->groups[i].start = m->groups[i].end = -1;
  ctx_t c = {
      .pat_end = pattern + strlen(pattern),
      .text_begin = text,
      .text_end = text + strlen(text),
      .m = m,
      .steps = 0,
  };
  const char *pat = pattern;
  if (*pat == '^') pat++;  // match zawsze kotwiczony na starcie (jak re.match)
  m->start = 0;
  return match_here(&c, pat, text);
}

int mr_group(const mr_match_t *m, int index, const char *text, char *out, size_t out_size) {
  if (index < 1 || index > m->group_count) return -1;
  const mr_group_t *g = &m->groups[index - 1];
  if (g->start < 0 || g->end < g->start) return -1;
  size_t n = (size_t)(g->end - g->start);
  if (n + 1 > out_size) return -1;
  memcpy(out, text + g->start, n);
  out[n] = '\0';
  return 0;
}
