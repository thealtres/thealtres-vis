"""
This script is used to convert data CSV files to JSON files.
Data can be: characters, plays, locations, authors, settings, publishers.

Usage: python json_conversion.py <data_type> <inp_filename> <out_filename>
"""
import csv
import json
import argparse
import re

TEMPLATE_MAP = {
  "char_data": {"characters": []},
  "play_data": {"plays": []},
  "location_data": {"locations": []},
  "author_data": {"authors": []},
  "setting_data": {"settings": []},
  "publisher_data": {"publishers": []}
}

parser = argparse.ArgumentParser()
parser.add_argument("data_type", help="Data type to convert to JSON",
                    type=str)
parser.add_argument("inp_filename", help="Name of input CSV file",
                    type=str)
parser.add_argument("out_filename", help="Name of output JSON file",
                    type=str)

args = parser.parse_args()

if args.data_type not in TEMPLATE_MAP:
    raise ValueError(f"Data type must be one of {list(TEMPLATE_MAP.keys())}")

def load_csv(filename: str) -> list:
    """Load a CSV file into a list of dictionaries.

    Args:
        filename (str): Name of CSV file to load.

    Returns:
        list: List of dictionaries,
        each dictionary being a row of the CSV file
        with column name as key and cell value as value.
    """
    with open(filename, "r", encoding="utf8") as f:
        return list(csv.DictReader(f))

def get_json_template(template_type: str) -> dict:
    """Get a JSON template depending on type.

    Args:
        type (str): Type of data to get JSON template for.

    Returns:
        dict: JSON template of type specified.
    """
    return TEMPLATE_MAP.get(template_type, {})

def convert_to_json(data: dict, template_type: str) -> dict:
    """Convert data to a specific JSON template depending on type.

    Args:
        data (dict): Data to convert to JSON.
        type (str): Type of data to convert to JSON.
    Returns:
        dict: Filled JSON template with data of type specified.
    """
    json_template = get_json_template(template_type)

    if template_type == "char_data":
        char_data = [{k: None if not v or v.isspace() else v.strip() for k, v in dct.items()}
            for dct in data]

        # convert zeroes as values of "cl", "isGrp" to False, and ones to True
        char_data = [{k: False if k in ["cl", "isGrp"] and v == "0.0"
                else v for k, v in dct.items()}
                for dct in char_data]
        char_data = [{k: True if k in ["cl", "isGrp"] and v == "1.0"
                else v for k, v in dct.items()}
                for dct in char_data]

        # convert ids to integers
        char_data = [{k: int(float(v)) if k in ["workId", "characterId"]
                and v is not None
                else v for k, v in dct.items()}
                for dct in char_data]

        # replace "government executive officials" values
        # with "government officials" for "professionalGroup" key
        # for consistency
        char_data = [{k: "government officials" if k == "professionalGroup"
                and v == "government executive officials"
                else v for k, v in dct.items()}
                for dct in char_data]

        for char_dict in char_data:
            json_template["characters"].append(char_dict)

    if template_type == "play_data":
        play_data = [{k: None if not v or v.isspace() else v.strip() for k, v in dct.items()}
            for dct in data]

        # remove plays with no lang
        play_data = [dct for dct in play_data if dct["lang"]]

        # split values with comma into list
        play_data = [{k: re.split("[,.]", v.replace(" ", ""))
                if k in ["authorId", "nbScenes"]
                and v is not None
                else v for k, v in dct.items()}
                for dct in play_data]

        # replace question marks with "unknown"
        play_data = [{k: "unknown" if v == "?" else v for k, v in dct.items()}
                for dct in play_data]

        # convert ids to integers
        play_data = [{k: int(float(v)) if k == "workId"
                and v is not None
                else v for k, v in dct.items()}
                for dct in play_data]

        # convert previously split ids in authorId to integers
        play_data = [{k: [int(float(id)) if k == "authorId"
                and id is not None
                else id for id in v]
                if isinstance(v, list)
                else v for k, v in dct.items()}
                for dct in play_data]


        for play_dict in play_data:
            json_template["plays"].append(play_dict)

    if template_type == "location_data":
        location_data = [{k: None if not v or v.isspace() else v.strip() for k, v in dct.items()}
            for dct in data]

        # convert ids to integers
        location_data = [{k: int(float(v)) if k in ["placeId"]
                and v is not None
                else v for k, v in dct.items()}
                for dct in location_data]

        for location_dict in location_data:
            json_template["locations"].append(location_dict)

    if template_type == "author_data":
        author_data = [{k: None if not v or v.isspace() else v for k, v in dct.items()}
            for dct in data]

        # convert ids to integers
        author_data = [{k: int(float(v)) if k in ["authorId"]
                and v is not None
                else v for k, v in dct.items()}
                for dct in author_data]

        # replace "sex" property nulls with "U"
        author_data = [{k: "U" if k in ["sex"]
                and v is None
                else v for k, v in dct.items()}
                for dct in author_data]

        for author_dict in author_data:
            json_template["authors"].append(author_dict)

    if template_type == "setting_data":
        setting_data = [{k: None if not v or v.isspace() else v.strip() for k, v in dct.items()}
            for dct in data]

        # convert ids to integers
        setting_data = [{k: int(float(v)) if k in ["workId", "actId", "sceneId"]
                and v is not None
                else v for k, v in dct.items()}
                for dct in setting_data]

        # split values with comma into list
        setting_data = [{k: v.replace(" ", "").replace(".", ",").split(",")
                if k == "placeId"
                and v is not None
                else v for k, v in dct.items()}
                for dct in setting_data]

        # convert previously split ids in placeId to integers
        setting_data = [{k: [int(float(id)) if k == "placeId"
                and id is not None
                else id for id in v]
                if isinstance(v, list)
                else v for k, v in dct.items()}
                for dct in setting_data]

        # replace "N/A" with null for "coord" key
        setting_data = [{k: None if k == "coord" and v == "#N/A"
                else v for k, v in dct.items()}
                for dct in setting_data]

        # copy coord key to OSMLongLat
        # to be consistent with location_data
        setting_data = [{**d, "OSMLatLon": d.pop("coord")}
                if "coord" in d
                else {**d, "OSMLatLon": None}
                for d in setting_data]

        # remove coord key
        setting_data = [{k: v for k, v in dct.items() if k != "coord"}
                for dct in setting_data]


        for setting_dict in setting_data:
            json_template["settings"].append(setting_dict)

    if template_type == "publisher_data":
        publisher_data = [{k: None if not v or v.isspace() else v.strip() for k, v in dct.items()}
            for dct in data]

        # convert ids to integers
        publisher_data = [{k: int(float(v)) if k in ["publisherId", "placeId"]
                and v is not None
                else v for k, v in dct.items()}
                for dct in publisher_data]

        for publisher_dict in publisher_data:
            json_template["publishers"].append(publisher_dict)

    return json_template

def write_json(filename: str, json_template: dict) -> None:
    """Write a JSON template to a JSON file.

    Args:
        filename (str): Name of JSON file to write.
        json_template (dict): JSON template to write to file.
    """
    with open(f"{filename}", "w", encoding="utf8") as f:
        json.dump(json_template, f, indent=4)
        print(f"{args.data_type} JSON file successfully written to {f.name}")

if __name__ == "__main__":
    csv_data = load_csv(args.inp_filename)
    json_templ = convert_to_json(csv_data, args.data_type)
    write_json(args.out_filename, json_templ)
