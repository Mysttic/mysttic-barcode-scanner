#ifndef MINI_REGEX_H_
#define MINI_REGEX_H_

#include <stddef.h>

#define MR_MAX_GROUPS 8

typedef struct {
  int start;
  int end;
} mr_group_t;

typedef struct {
  int start;                    // zawsze 0 (kotwiczenie jak re.match)
  int end;                      // koniec dopasowania w tekscie
  int group_count;
  mr_group_t groups[MR_MAX_GROUPS];
} mr_match_t;

// Zwraca 1 przy dopasowaniu (od poczatku tekstu, jak re.match), 0 przy braku.
int mr_match(const char *pattern, const char *text, mr_match_t *m);
// Kopiuje tresc grupy 1..group_count do out; -1 przy bledzie.
int mr_group(const mr_match_t *m, int index, const char *text, char *out, size_t out_size);

#endif
