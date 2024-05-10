# thealtres-vis

This project contains source and data for the "Visualization" section of the _Thealtres_ project website. The _Thealtres_ project is a digital humanities project which aims at comparing theater in Alsatian with popular theater in German and French. For more information, visit the [project website](https://thealtres.pages.unistra.fr/).

<details>
  <summary><b>Click to preview website</b></summary>
  ![Visualization Website Preview](https://i.imgur.com/fuMQGrY.png)
</details>

## Project structure

This repository contains two main folders: **scripts/json_conversion** and **website**.

The **scripts/json_conversion** folder contains original, annotated CSV data of the _Thealtres_ project. A Python script (`json_conversion.py`) was created to convert the data to the JSON format in order to integrate it to the website.
The following data types are made available: char_data, play_data, author_data, publisher_data, location_data, setting_data.

The **website** folder contains source for the _Thealtres_ project website and was forked from [https://git.unistra.fr/thealtres/thealtres.pages.unistra.fr](https://git.unistra.fr/thealtres/thealtres.pages.unistra.fr).
Uses [Hugo](https://gohugo.io/) v0.101.0.

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