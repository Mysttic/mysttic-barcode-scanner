# Teaching the extension a profile — step by step

Learning mode is how you add support for **any form** without writing a line of
anything: you scan a code, name its segments and click the fields they should go
into. The profile works immediately and can be exported to other workstations.

This tutorial walks through the whole thing on the **"Zamówienie leku"**
(medicine order) page, `forms/form-c-medicine.html`, which is both on the
`MYSTTIC` disk and in this repository. The code is a GS1 DataMatrix like the one
on a real medicine box. The scanner stays in its normal production configuration
(the `gs1-datamatrix` profile enabled) and on a scan types the sequence
`GTIN TAB date TAB batch TAB serial-number ENTER`. What we teach the extension is
what to do with that sequence on this particular page.

> For this exercise, switch off the built-in demo profile for this page
> ("Zamówienie leku (demo)" under **Profile formularzy**). Otherwise it fills the
> form before the profile you are teaching gets a chance: the first matching
> profile wins.

The extension's user interface is in Polish; the Polish button labels are given
below in brackets.

## Step 0 — preparation

1. The scanner is plugged in and the extension is installed
   ([BROWSER-EXTENSION.md](BROWSER-EXTENSION.md), section "Instalacja").
2. Open the form you are making a profile for, here
   `forms/form-c-medicine.html` from the `MYSTTIC` disk (or from the repository).

## Step 1 — start learning mode and scan a code

Click the **extension icon** in the toolbar → **Ucz formularza** (Teach a form).
A wizard panel appears (1/3). Scan the code off the box (here: the DataMatrix on
the page). The characters **do not reach the form**, the extension only observes
them.

![Step 1: the learning panel, waiting for a scan](img/extension-medicine-1-start.png)

## Step 2 — name the segments

The extension has already cut up what the scanner typed (it recognised the
separator, here the tab from the TAB sequence) and shows the segments: the values
from your code on the left, name fields on the right. Type names that mean
something to you, here `gtin`, `dataWaznosci`, `partia`, `numerSeryjny`. Mark a
segment that should be skipped (a fixed prefix, say) with `_`.

![Step 2: the named segments of the code](img/extension-medicine-2-segments.png)

## Step 3 — point at the fields and confirm

The wizard asks about each name in turn and shows the value that will go there.
Move over the form (the field under the cursor is highlighted) and click the
right one: for `gtin` the "Kod produktu (GTIN)" field, for `dataWaznosci` the
"Data ważności" field, and so on.

A click **selects** the field (it gets a permanent green outline) but does not
advance on its own. The panel shows the choice and waits for a decision:

- **Zatwierdź i dalej** (Confirm and continue) saves the assignment and asks
  about the next name,
- **Wybierz inne pole** (Pick another field) — made a mistake? just click a
  different field,
- **← Wstecz** (Back) returns to the PREVIOUS name, whose assignment is shown
  again for confirmation or change. This is how you fix an earlier choice,
- **Pomiń pole** (Skip field) — this name has no counterpart on this form.

![Step 3: a field is selected, the panel waits for confirmation](img/extension-medicine-3-fields.png)

When a value looks like a date, the panel adds a row of buttons previewing
formats. If your form wants dates in a different shape than the code carries,
click the ready result instead of **Zatwierdź i dalej**. Details:
[BROWSER-EXTENSION.md → Format wartości wychodzącej](BROWSER-EXTENSION.md#format-wartości-wychodzącej).

![The date format buttons](img/extension-date-format.png)

## Step 4 — save the profile

Give the profile a name (for example "Zamówienie leku — mój profil") and check
the suggested **address pattern**: the profile will only activate on matching
pages (`*` stands for any fragment). The **← Wstecz** (Back) button returns to
the last field if you want to correct something. Click **Zapisz i włącz** (Save
and enable).

![Step 4: profile name and address pattern](img/extension-medicine-4-save.png)

## Step 5 — check it

Scan the same code again, **without clicking into any field**: the values land
where they belong (the serial number and the expiry date in the right fields
despite the shuffled order), the decoy fields stay empty, and a toast confirms
which profile fired. The "stan strony" (page state) panel at the bottom shows
that the form really did accept the values.

![Step 5: the profile works, the form is filled by name](img/extension-medicine-5-works.png)

## What next

- **Managing profiles** (renaming, changing the address, reordering, duplicating,
  deleting): the extension icon → **Profile formularzy**, described in
  [BROWSER-EXTENSION.md](BROWSER-EXTENSION.md).
- **Rolling it out:** in the same place, **Eksportuj do pliku** (Export to file),
  then **Importuj z pliku** (Import from file) on the other computers.
- **Pages to practise on:** a range of public training forms in
  [FORMS.md](FORMS.md), section "Poligon".
