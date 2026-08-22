// Domyslna konfiguracja wtyczki (uzywana, gdy w chrome.storage nic nie zapisano)
// oraz wspolna logika dopasowania profilu do adresu strony.
// Wspoldzielone przez content.js i options.js (zwykle <script>, bez modulow).

const BC_DEFAULTS = {
  enabled: true,
  prefix: "WEB;",
  // kolejnosc pol w ramce: WEB;pole1;pole2;... (koniec = Enter z czytnika)
  fields: ["imie", "nazwisko", "email", "telefon", "ulica", "miasto", "kod", "data", "szukaj"],
  profiles: [
    { name: "Selenium web-form", host: "selenium.dev", enabled: true, map: {
      "input[name=my-text]": "{imie} {nazwisko}",
      "textarea[name=my-textarea]": "{ulica}, {kod} {miasto}",
      "input[name=my-date]": "{data}" } },
    { name: "ParaBank rejestracja", host: "parabank.parasoft.com", enabled: true, map: {
      "[id=\"customer.firstName\"]": "{imie}",
      "[id=\"customer.lastName\"]": "{nazwisko}",
      "[id=\"customer.address.street\"]": "{ulica}",
      "[id=\"customer.address.city\"]": "{miasto}",
      "[id=\"customer.address.state\"]": "mazowieckie",
      "[id=\"customer.address.zipCode\"]": "{kod}",
      "[id=\"customer.phoneNumber\"]": "{telefon}" } },
    { name: "Toolshop rejestracja", host: "practicesoftwaretesting.com", path: "/auth/register", enabled: true, map: {
      "#first_name": "{imie}",
      "#last_name": "{nazwisko}",
      "#dob": "{data}",
      "#street": "{ulica}",
      "#postal_code": "{kod}",
      "#city": "{miasto}",
      "#state": "mazowieckie",
      "#phone": "{telefon}",
      "#email": "{email}",
      "#country": "PL" } },
    { name: "Toolshop wyszukiwarka", host: "practicesoftwaretesting.com", enabled: true, map: {
      "#search-query": "{szukaj}" } },
    { name: "DemoQA formularz", host: "demoqa.com", enabled: true, map: {
      "#firstName": "{imie}",
      "#lastName": "{nazwisko}",
      "#userEmail": "{email}",
      "#userNumber": "{telefon}",
      "#currentAddress": "{ulica}, {kod} {miasto}" } },
    { name: "AutomationExercise signup", host: "automationexercise.com", enabled: true, map: {
      "form[action=\"/signup\"] input[name=name]": "{imie} {nazwisko}",
      "form[action=\"/signup\"] input[name=email]": "{email}" } },
    { name: "DataTables filtr", host: "datatables.net", enabled: true, map: {
      "#dt-search-0": "{szukaj}" } },
    { name: "httpbin zamowienie", host: "httpbin.org", enabled: true, map: {
      "[name=custname]": "{imie} {nazwisko}",
      "[name=custtel]": "{telefon}",
      "[name=custemail]": "{email}" } }
  ]
};

// Pierwszy profil pasujacy do hosta i (opcjonalnie) sciezki.
// Profile ze sciezka umieszczaj w konfiguracji PRZED ogolnymi dla tego samego hosta.
function bcMatchProfile(cfg, loc) {
  if (!cfg || cfg.enabled === false) return null;
  const h = loc.hostname.replace(/^www\./, "");
  for (const p of cfg.profiles || []) {
    if (p.enabled === false) continue;
    if ((h === p.host || h.endsWith("." + p.host)) && (!p.path || loc.pathname === p.path)) return p;
  }
  return null;
}
