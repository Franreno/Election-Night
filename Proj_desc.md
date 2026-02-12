# Technical Challenge - Election Night

## Background & Context

On election night, results are received continuously from an external data supplier.
These results arrive as files that are updated throughout the night as constituencies
declare results or correct previously reported figures.

The goal of this challenge is to design and build a system capable of ingesting
these files, maintaining an accurate and up-to-date view of the election results, and
exposing those results via APIs and a user interface.

The challenge is intentionally open-ended. It is designed to reflect the kind of
ambiguity and evolving data that engineers encounter in real systems, particularly
where correctness, updates, and aggregation matter.

## The problem

You are required to build a full-stack application that can process election result
files and present meaningful insights derived from them.

At a high level, the system should:
    - ingest raw election result files
    - store and update results correctly over time
    - expose processed data through RESTful APIs
    - display the results in a simple web interface
    - run locally using Docker Compose

## Input Data Format

The data supplier provides files where each line represents the result for a single
constituency.

Each row contains:
- the name of a constituency
- a variable-length sequence of values representing votes cast and party codes

The number of parties per constituency is not fixed and may vary between rows.

The application is expected to parse this data reliably and tolerate variation in row
length.

An example input file is provided alongside this challenge and should be treated as
representative of the expected data format.

* Some constituency names may themselves contain commas. In these cases,
commas within names are escaped using \, and should be treated as part of the
name rather than as field separators.

## Workflow

Result files will continue to arrive throughout the night. These files may include:
- new constituencies reporting results for the first time
- updated vote counts for constituencies already processed
- corrections to previously reported data

When processing new files:
- if a constituency does not already exist in the system, it should be added
- if a constituency already exists:
    - any party results included in the new file must override existing values
    - party results not present in the new file must remain unchanged

At any point in time, the system should represent the latest known correct state of
the election results.

## RESTful APIs

The backend must provide a mechanism for the data supplier to upload result files.

This import process should:
- accept raw election result files
- parse and process the data
- apply update and override rules correctly
- handle malformed input gracefully without compromising stored data

The focus here is reliability rather than throughput.

## Constituency API

This API provides a constituency-level view of the results. For each constituency, it
should expose:

- the constituency name
- the parties contesting the constituency
- the number of votes received by each party
- the percentage share of the vote per party
- the party currently winning the constituency

## Total Results API

This API provides an aggregated, national-level view of the election. It should
expose:

- the total number of votes received by each party across all constituencies
- the total number of MPs per party, where an MP is awarded to the party winning a constituency

This API represents the overall state of the election at the time it is queried.

## User Interface

A web-based UI must be provided to display election results. The UI should include:

### Constituency View

A view that displays constituency-level results using the Constituency API,
including:

- constituency name
- winning party
- vote distribution per party

### Parliament Distribution View

A view that shows how parliamentary seats are distributed across parties using
data from the Total Results API.

The exact visual design is left to the candidate. Clarity and correctness are more
important than visual complexity.

### Technical Constraints

Technology Stack
- Frontend: Next.js
- Backend: Python (FASTAPI)
- Database: PostgreSQL and SQLAlchemy
- Containerization: Docker and Docker Compose

Candidates are free to choose how the system is structured internally. This includes
selecting supporting libraries and frameworks, defining an appropriate database
schema, and designing the data ingestion and update mechanisms in a way that
best satisfies the problem requirements.

## Packaging and Execution

The entire system must:
- run locally using Docker Compose
- include frontend, backend, and database services
- start successfully using a single command

All necessary setup steps should be clearly documented.

## Optional Enhancements

While not required, the following enhancements are welcomed:

- real-time or near-real-time updates in the UI
- progress or status indication during file imports
- automated test coverage
- thoughtful handling of edge cases and data validation


## Submission
Candidates should submit a GitHub repository

The submission must include:
- all source code
- Docker configuration
- a README explaining:
    - how to run the system
    - how result files are uploaded
    - any assumptions or design decisions made

## Appendix

### Party Codes

Each party is represented in the input data using a short code. These codes must be
translated into full party names when presenting results through APIs or the UI.
The following mappings apply:

| Code | Party Name |
|------|------------|
| C | Conservative Party |
| L | Labour Party |
| UKIP | UKIP |
| LD | Liberal Democrats |
| G | Green Party |
| Ind | Independent |
| SNP | SN  |

---

## Additions — Planned Enhancements

The following features are planned to further improve the election results dashboard. They go beyond the core requirements and are designed to provide a richer, more interactive experience.

### 1. England Choropleth Interactive Map

**Goal**: Provide a geographic visualization of election results overlaid on a constituency boundary map.

**Dashboard Overview Map**
- A full England/Wales/Scotland choropleth map on the Dashboard page showing all constituencies.
- Each constituency polygon is coloured by the winning party's colour.
- Hovering over a constituency shows a tooltip with: constituency name, winning party, vote margin.
- Clicking a constituency navigates to its detail page (`/constituencies/[id]`).
- Constituencies without results are shown in a neutral grey.

**Constituency Detail Map**
- On the `/constituencies/[id]` page, a zoomed-in map centred on the selected constituency.
- The selected constituency is highlighted; surrounding constituencies are shown with reduced opacity.
- This provides geographic context for where the constituency sits within its region.

**Technical Approach**
- Use **GeoJSON boundary data** from the ONS (Office for National Statistics) Open Geography Portal, which provides parliamentary constituency boundary files.
- Render the map using a lightweight library such as **react-simple-maps** (built on D3-geo) or **Leaflet with react-leaflet**.
- GeoJSON file served as a static asset from `/public` or fetched on demand.
- The constituency `name` field in the GeoJSON properties is matched against the database constituency names for colouring.
- Projection: British National Grid (EPSG:27700) or Albers Equal-Area for a clean visual.

**Considerations**
- GeoJSON file size: UK parliamentary boundary files are ~5–10 MB. Consider TopoJSON compression (reduces to ~1–2 MB) or simplification with mapshaper.
- Matching: Constituency names in the data file may not exactly match ONS names. A normalisation/mapping layer may be needed.
- Performance: For 650 constituency polygons, react-simple-maps or an SVG-based approach performs well. Canvas-based rendering (Leaflet) is an alternative for smoother zoom/pan.

### 2. Parliamentary Seats Diagram (Hemicycle)

**Goal**: Display a hemicycle (semicircle) diagram showing the distribution of parliamentary seats by party, similar to the visualisations used by the BBC and Wikipedia for UK elections.

**Placement**: Dashboard page, alongside or replacing the existing seat distribution bar chart.

**Design**
- A semicircular arrangement of dots/circles, one per constituency (up to 650).
- Dots are coloured by the winning party.
- Dots are grouped by party, arranged from left to right in traditional political spectrum order (or by seat count descending).
- A legend below maps each colour to the party name and seat count.
- The centre of the hemicycle can display the "magic number" (326 for a majority) and which party, if any, has crossed it.

**Technical Approach**
- Render as an **SVG** generated in a React component.
- Each dot is positioned using polar coordinates on concentric semicircular arcs.
- Algorithm: distribute N seats across R rows of a semicircle, with each row having proportionally more seats than inner rows (similar to the European Parliament hemicycle layout).
- The component receives `parties: { party_code: string; seats: number }[]` and generates the layout.
- Consider using **D3** for the layout calculation only (d3-shape arc generator) while React handles the rendering.
- Alternatively, use an existing open-source hemicycle library if one fits.

**Considerations**
- Responsive sizing: the SVG should scale cleanly with `viewBox` and percentage-based width.
- Animation: optionally animate dots appearing as results come in (using CSS transitions on opacity).
- Accessibility: include an `aria-label` describing the seat distribution in text form.
- The hemicycle is a read-only visualisation; interactivity is limited to tooltips on hover (party name + seat count for that segment).