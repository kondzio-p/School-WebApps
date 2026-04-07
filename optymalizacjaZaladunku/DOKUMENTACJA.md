# Dokumentacja - Optymalizacja Załadunku Cargo

## Opis aplikacji

Aplikacja webowa do wizualizacji i optymalizacji załadunku kontenerów/naczep w 3D. Użytkownik definiuje wymiary przestrzeni ładunkowej, dodaje paczki z różnymi parametrami, a algorytm automatycznie rozmieszcza je w optymalny sposób. Wynik jest renderowany w czasie rzeczywistym na interaktywnej scenie 3D.

**Technologie:** React + TypeScript, Three.js (via @react-three/fiber i @react-three/drei), Vite, Tailwind CSS.

---

## Jak działa dodawanie paczek

### Kolejność operacji

1. Użytkownik wybiera szablon (europaleta, kontener itp.) lub wpisuje własne wymiary paczki.
2. Ustawia nazwę, wymiary (szerokość, wysokość, długość), wagę i tryb piętrowania.
3. Po kliknięciu "Dodaj paka" system:
    - Waliduje wymiary (muszą być > 0) i wagę (nie może przekroczyć limitu kontenera).
    - Dodaje paczkę do listy `itemsToPack` z unikalnym ID.
    - Automatycznie uruchamia `calculateLayout()` (via `useEffect`), który przelicza rozmieszczenie WSZYSTKICH paczek od nowa.
4. Jeśli nowa paczka nie zmieści się fizycznie, wyświetla komunikat błędu i cofa dodanie.

### Algorytm rozmieszczania - First Fit Decreasing (FFD)

Wybrano wariant algorytmu **First Fit Decreasing** z rotacjami, bo:

- **Jest prosty i zrozumiały**
- **Daje dobre wyniki w praktyce** - sortowanie od największych gwarantuje, że duże paczki (które najtrudniej dopasować) trafiają na swoje miejsce jako pierwsze.
- **Obsługuje rotacje** - każda paczka może być obrócona na 6 sposobów, co drastycznie zwiększa szansę na dopasowanie.

#### Krok po kroku:

1. **Sortowanie** - paczki sortowane malejąco po objętości (`w * h * d`). Duże krowy najpierw, drobnica na koniec.
2. **Generowanie orientacji** - dla każdej paczki generowane jest 6 możliwych orientacji (rotacji). Preferowane są te z niższą wysokością (paczka kładziona "na płasko").
3. **Skanowanie przestrzeni** - algorytm przeszukuje kontener krokiem 0.1m po osiach Z→Y→X (najpierw w głąb, potem w górę, potem na boki).
4. **Sprawdzanie kolizji** - dla każdej pozycji i orientacji sprawdzane jest:
    - Czy paczka mieści się w kontenerze (nie wystaje poza ściany).
    - Czy nie koliduje z już umieszczonymi paczkami (AABB collision detection).
    - Czy nie narusza zasad piętrowania.
5. **Sprawdzanie stabilności** - jeśli paczka jest powyżej podłogi, algorytm oblicza jaki procent jej podstawy jest podparty przez górne powierzchnie paczek znajdujących się bezpośrednio pod nią. Wymagane jest **minimum 70% podparcia** - w przeciwnym razie pozycja jest odrzucana. Zapobiega to sytuacjom, w których długie paczki "wiszą w powietrzu" i w rzeczywistości by się przewróciły.
6. **Pierwsza pasująca pozycja wygrywa** - algorytm bierze pierwszy znaleziony slot ("first fit").

#### Dlaczego nie inne algorytmy?

- **Bin Packing 3D jest NP-trudny** - optymalne rozwiązanie wymagałoby przeszukiwania wykładniczej liczby kombinacji, co jest niepraktyczne dla aplikacji real-time.
- **Algorytmy genetyczne/symulowane wyżarzanie** - dają lepsze wyniki, ale są skomplikowane w implementacji i wolne.
- **FFD to dobry kompromis** - działa szybko, daje wyniki bliskie optimum (~70-80% efektywności), i jest łatwy do rozszerzenia.

---

## Tryby piętrowania

Aplikacja obsługuje 3 tryby piętrowania (stacking modes), co pozwala na realistyczne modelowanie różnych typów ładunku:

### 1. Zwykłe (`standard`)

- Paczka może być umieszczona gdziekolwiek.
- Inne paczki mogą być kładzione na nią.
- Krawędzie: białe.

### 2. Niepiętrowalna (`nonStackable`)

- Paczka jest delikatna - **nic nie może stać na niej**.
- Algorytm blokuje każdą paczkę, której footprint (rzut na XZ) pokrywa się z tą paczką i jest powyżej niej.
- Krawędzie: czerwone (żeby od razu było widać).

### 3. Tylko na dół (`bottomOnly`)

- Paczka **musi stać na podłodze** kontenera (y = 0).
- Nie może być umieszczona na innej paczce.
- Krawędzie: niebieskie.

---

## Funkcjonalności

- **Szablony pojazdów** - naczepa 13.6m, kontener 40ft/20ft, bus - wymiary ładowane jednym klikiem.
- **Szablony paczek** - europaleta, paleta przemysłowa, paczka krucha, karton standardowy.
- **Własne wymiary** - pełna konfiguracja kontenera i paczek.
- **Nazwa paczki** - każda paczka ma swoją nazwę widoczną w 3D na scenie i w panelu listy.
- **Wizualizacja 3D** - interaktywna scena z obrotem kamery (OrbitControls), cieniami i oświetleniem.
- **Panel boczny z listą** - lista wszystkich załadowanych paczek z możliwością ukrywania/pokazywania.
- **Statystyki** - liczba paczek, waga, procent wykorzystania objętości z paskiem postępu.
- **Kontrola wagi** - ostrzeżenie przy zbliżaniu się do limitu.
- **Reset** - szybkie czyszczenie załadunku.

---

## Możliwości rozwoju

- **Drag & drop** - ręczne przeciąganie paczek na scenie 3D.
- **Eksport/import** - zapisywanie i wczytywanie konfiguracji ładunku (JSON/CSV).
- **Optymalizacja algorytmu** - użycie heurystyk typu guillotine cut lub skyline do lepszego wypełnienia.
- **Rozkład ciężaru** - wizualizacja rozkładu masy na osiach (ważne dla transportu drogowego).
- **Wielokrotne załadunki** - planowanie rozładunku w kolejności dostaw (LIFO).
- **Historia zmian** - undo/redo operacji dodawania/usuwania.
- **PDF z raportem** - generowanie dokumentu załadunkowego dla kierowcy.
- **Backend z bazą** - zapisywanie konfiguracji w bazie danych i udostępnianie linkiem.
- **Grupowanie paczek** - oznaczanie paczek należących do tego samego zlecenia.

---

## Licencja

Copyright (c) 2025-2026

Niniejszy kod źródłowy jest udostępniony na następujących warunkach:

1. **DOZWOLONE** - dowolna edycja, modyfikacja i wykorzystanie kodu do celów własnych (edukacyjnych, prywatnych, wewnętrznych w firmie).
2. **ZABRONIONE** - odsprzedaż, sublicencjonowanie lub dystrybucja komercyjna tego oprogramowania (w całości lub części) bez uprzedniego wykupienia pełnej licencji komercyjnej od autora.
3. Wszelkie prace pochodne muszą zawierać tę samą notatkę licencyjną.

W celu uzyskania licencji komercyjnej proszę o kontakt.

**OPROGRAMOWANIE JEST DOSTARCZANE "TAK JAK JEST", BEZ JAKIEJKOLWIEK GWARANCJI.**
