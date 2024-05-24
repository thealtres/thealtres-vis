# thealtres-vis

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.11289442.svg)](https://doi.org/10.5281/zenodo.11289442)


This project contains source code and data for the "Visualization" section of the _Thealtres_ project website. The _Thealtres_ project is a digital humanities project which aims at comparing theater in Alsatian with popular theater in German and French. For more information, visit the [project website](https://thealtres.pages.unistra.fr/).

The goal of the thealtres-vis project is to create a user-friendly, appealing visualization UI for data of the _Thealtres_ project, enabling users to easily view, filter, search and analyze trends across thousands of French, German and Alsatian plays. The web app was originally developed by [Enzo Doyen](https://edoyen.com/) as part of an internship under the supervision of [Pablo Ruiz Fabo](https://ruizfabo.link/unistra).

This project is based on the original [Thealtres project website](https://git.unistra.fr/thealtres/thealtres.pages.unistra.fr), created with [Hugo](https://gohugo.io/). The web app was developed using TypeScript and leverages some JS libraries such as [Tom Select](https://tom-select.js.org/) (for dropdown search), [Leaflet](https://leafletjs.com/) (for map visualization of location and setting data), [D3.js](https://d3js.org/) (for custom charts) and [JSZip](https://stuk.github.io/jszip/) (for downloading data).

<details>
  <summary><b>Click to preview website</b></summary>
  <img src="https://i.imgur.com/fuMQGrY.png" alt="Visualization Website Preview">
</details>

## Project structure

This repository contains two main folders: **scripts/json_conversion** and **website**.

The **scripts/json_conversion** folder contains original, annotated CSV data of the _Thealtres_ project. A Python script (`json_conversion.py`) was created to convert the data to the JSON format in order to integrate it to the website.
The following data types are made available: char_data, play_data, author_data, publisher_data, location_data, setting_data.

The **website** folder contains source for the _Thealtres_ project website and was forked from [https://git.unistra.fr/thealtres/thealtres.pages.unistra.fr](https://git.unistra.fr/thealtres/thealtres.pages.unistra.fr).
Uses Hugo v0.101.0.

## Usage

`git clone https://github.com/thealtres/thealtres-vis.git`

### json_conversion.py

1) `cd thealtres-vis/scripts/json_conversion`
2) `python json_conversion.py <data_type> <inp_filename> <out_filename>`

E.g., if you want to convert char_data.csv to char_data.json and place that file directly inside the corresponding website folder:

`python json_conversion.py char_data csv/char_data.csv ../../website/static/json/char_data.json`

### website

1) `cd thealtres-vis/website`
2) `hugo serve`
3) Open [http://localhost:1313](http://localhost:1313)

## Screenshots

![image](https://github.com/thealtres/thealtres-vis/assets/20565963/812781d3-b2dd-442b-86e4-81003e9a314e)
Main view.

![image](https://github.com/thealtres/thealtres-vis/assets/20565963/410d7984-ea06-4250-8587-abfb8e494b60)
Geolocated publisher locations and play settings.

