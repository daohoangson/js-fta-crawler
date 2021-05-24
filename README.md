# FTA crawler

[FTA website](https://fta.moit.gov.vn) crawler to extract tarrif information.

## Usage

### Pre-built binaries

This repository has been setup to build standalone binaries for Linux, macOS and Windows for each commits.
Node.js is no longer required if you are using the binary.
Replace `npm start` with the downloaded file to use it directly:

```bash
crawl-win.exe --export mexico
```

Please note that some OSes have built-in protection which will block running the binary after downloading.
You may need to double click the file to trigger the bypass procedure before executing it in the command line.

### Prerequisite

```bash
# Install Node.js via Homebrew
# or go to https://nodejs.org/en/download/ yourself
brew install node

# Install dependencies
npm install
```

### Command line arguments

Get import tarrifs from Mexico:

```bash
npm start -- --import mexico
```

Get export tarrifs to Mexico:

```bash
npm start -- --export mexico
```

Use country ID instead of name (check the website or see [the table below](#countries)):

```bash
# 144 is the ID for Mexico
npm start -- --export 144
```

Get both import & export data:

```bash
npm start -- --export --import mexico
```

Get data for multiple countries:

```bash
npm start -- --export --import duc mexico
```

## Output

The script will save data into separate CSV files in the current directory.
Each file contains data for a direction (export or import) of a country.
Filename format: `country-direction.csv` (e.g. `mexico-in.csv`, [mexico-out.csv](https://gist.github.com/daohoangson/0f0e28defc6f394a24990eb0d1f4b20f)).

## Countries

The script will get the up to date list upon execution.
The table below is for reference only:

| ID | Name |
| --- | --- |
| 15 | Áo |
| 177 | Ba Lan |
| 22 | Bỉ |
| 178 | Bồ Đào Nha |
| 40 | Canada |
| 60 | Cộng hòa Séc |
| 59 | Cộng hòa Síp |
| 56 | Croatia |
| 61 | Đan Mạch |
| 83 | Đức |
| 70 | Estonia |
| 157 | Hà Lan |
| 101 | Hungary |
| 86 | Hy Lạp |
| 107 | Ireland |
| 123 | Latvia |
| 129 | Lithuania |
| 130 | Luxembourg |
| 138 | Malta |
| 144 | Mexico |
| 159 | New Zealand |
| 112 | Nhật Bản |
| 76 | Pháp |
| 75 | Phần Lan |
| 182 | Romania |
| 200 | Singapore |
| 202 | Slovakia |
| 203 | Slovenia |
| 209 | Tây Ban Nha |
| 215 | Thụy Điển |
| 14 | Úc |
| 110 | Ý |
