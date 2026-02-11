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