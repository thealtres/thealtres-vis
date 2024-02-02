"""
This script is identical to json_conversion.py, but merges play data
with character data in the JSON template.
In the end, we chose to use json_conversion.py to keep the data separate.
"""

import csv
import json
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("chardata_filename", help="Character data CSV file to convert to JSON",
                    type=str)
parser.add_argument("playdata_filename", help="Play data CSV file to convert to JSON",
                    type=str)
parser.add_argument("out_filename", help="Name of output JSON file",
                    type=str)

args = parser.parse_args()

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

def convert_to_json(char_data: dict, play_data: dict) -> dict:
    """Convert character data and play data to a JSON template.
    
    Args:
        char_data (dict): Character data.
        play_data (dict): Play data.
        
    Returns:
        dict: JSON template with character data.
    """
    char_data = [{k: None if not v else v for k, v in dct.items()}
        for dct in char_data]

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

    json_template = {"data": {"characters": []}}

    for char_dict in char_data:
        play_id = char_dict["workId"]
        play_info = [dct for dct in play_data if int(dct["workId"]) == play_id]

        if play_info:
            char_dict["play_info"] = play_info[0]

        json_template["data"]["characters"].append(char_dict)

    return json_template

def write_json(filename: str, json_template: dict) -> None:
    """Write a JSON template to a JSON file.

    Args:
        filename (str): Name of JSON file to write.
        json_template (dict): JSON template to write to file.
    """
    with open(f"{filename}", "w", encoding="utf8") as f:
        json.dump(json_template, f, indent=4)
        print(f"JSON file successfully written to {f.name}")

if __name__ == "__main__":
    char_data = load_csv(args.chardata_filename)
    play_data = load_csv(args.playdata_filename)
    json_template = convert_to_json(char_data, play_data)
    write_json(args.out_filename, json_template)