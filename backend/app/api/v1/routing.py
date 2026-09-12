from __future__ import annotations

import math
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OSRM_URL = "https://router.project-osrm.org/route/v1/driving"


class RouteStep(BaseModel):
    instruction: str
    distance_m: float
    duration_s: float


class EvacuationRoute(BaseModel):
    destination_name: str
    destination_type: str
    destination_latitude: float
    destination_longitude: float
    distance_m: float
    duration_s: float
    geometry: list[list[float]]
    steps: list[RouteStep]
    alternatives_considered: int
    prototype_safety_score: int
    reasons: list[str]
    source: str
    warning: str


def _destination_priority(tags: dict[str, Any]) -> int:
    amenity = str(tags.get("amenity", ""))
    if amenity in {"hospital", "clinic"}:
        return 0
    if amenity in {"shelter", "community_centre"}:
        return 1
    if amenity in {"school", "college", "university"}:
        return 2
    return 3


def _name_for(tags: dict[str, Any], fallback: str) -> str:
    return str(tags.get("name:en") or tags.get("name") or fallback)


async def _nearby_destinations(latitude: float, longitude: float) -> list[dict[str, Any]]:
    query = f"""
    [out:json][timeout:12];
    (
      nwr(around:5000,{latitude},{longitude})[amenity~"^(shelter|community_centre|hospital|clinic|school|college|university)$"];
    );
    out center tags 30;
    """
    async with httpx.AsyncClient(timeout=15.0, headers={"User-Agent": "JalRakshak-HackRice/1.0"}) as client:
        response = await client.post(OVERPASS_URL, content=query)
        response.raise_for_status()
        payload = response.json()

    destinations: list[dict[str, Any]] = []
    for element in payload.get("elements", []):
        lat = element.get("lat") or (element.get("center") or {}).get("lat")
        lon = element.get("lon") or (element.get("center") or {}).get("lon")
        if lat is None or lon is None:
            continue
        tags = element.get("tags") or {}
        destinations.append(
            {
                "latitude": float(lat),
                "longitude": float(lon),
                "name": _name_for(tags, "Nearby safe facility"),
                "type": str(tags.get("amenity", "facility")),
                "priority": _destination_priority(tags),
            }
        )

    destinations.sort(key=lambda item: item["priority"])
    return destinations[:8]


async def _osrm_routes(origin_lat: float, origin_lon: float, destination: dict[str, Any]) -> list[dict[str, Any]]:
    url = f"{OSRM_URL}/{origin_lon},{origin_lat};{destination['longitude']},{destination['latitude']}"
    params = {
        "alternatives": "true",
        "steps": "true",
        "overview": "full",
        "geometries": "geojson",
    }
    async with httpx.AsyncClient(timeout=15.0, headers={"User-Agent": "JalRakshak-HackRice/1.0"}) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()
    if data.get("code") != "Ok":
        return []
    return data.get("routes", [])[:3]


def _score_route(route: dict[str, Any], destination: dict[str, Any]) -> tuple[float, int, list[str]]:
    distance = float(route.get("distance") or 0.0)
    duration = float(route.get("duration") or 0.0)
    legs = route.get("legs") or []
    steps = legs[0].get("steps", []) if legs else []
    maneuver_count = len(steps)

    # Prototype safety ranking: prefer emergency/community facilities, then less exposure time,
    # shorter distance, and fewer maneuvers. This is intentionally not presented as an
    # official flood-clearance model until verified road-closure/flood-depth feeds are connected.
    category_penalty = destination["priority"] * 480.0
    score = duration + distance * 0.08 + maneuver_count * 10.0 + category_penalty

    safety_score = max(35, min(96, int(round(100 - min(score / 180.0, 65)))))
    reasons = [
        "Uses a real routable road path from the current GPS position.",
        "Prefers emergency/community facilities before ordinary schools when available.",
        "Ranks alternatives using travel exposure time, distance, and route complexity.",
    ]
    if destination["priority"] <= 1:
        reasons.append("Destination type is prioritized for emergency evacuation support.")
    return score, safety_score, reasons


def _format_instruction(step: dict[str, Any]) -> str:
    maneuver = step.get("maneuver") or {}
    kind = str(maneuver.get("type") or "continue").replace("_", " ").title()
    modifier = str(maneuver.get("modifier") or "").replace("_", " ")
    name = str(step.get("name") or "the road")
    if modifier:
        return f"{kind} {modifier} onto {name}"
    return f"{kind} onto {name}"


@router.get("/evacuation", response_model=EvacuationRoute)
async def evacuation_route(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
) -> EvacuationRoute:
    try:
        destinations = await _nearby_destinations(latitude, longitude)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Nearby safe-destination lookup failed: {exc}") from exc

    if not destinations:
        raise HTTPException(status_code=404, detail="No nearby evacuation facilities were found within 5 km")

    candidates: list[tuple[float, int, list[str], dict[str, Any], dict[str, Any]]] = []
    for destination in destinations[:5]:
        try:
            routes = await _osrm_routes(latitude, longitude, destination)
        except Exception:
            continue
        for route in routes:
            score, safety_score, reasons = _score_route(route, destination)
            candidates.append((score, safety_score, reasons, destination, route))

    if not candidates:
        raise HTTPException(status_code=502, detail="Road routing service could not calculate an evacuation path")

    candidates.sort(key=lambda item: item[0])
    _, safety_score, reasons, destination, route = candidates[0]
    geometry_coordinates = (route.get("geometry") or {}).get("coordinates") or []
    geometry = [[float(coord[1]), float(coord[0])] for coord in geometry_coordinates if len(coord) >= 2]

    legs = route.get("legs") or []
    raw_steps = legs[0].get("steps", []) if legs else []
    steps = [
        RouteStep(
            instruction=_format_instruction(step),
            distance_m=float(step.get("distance") or 0.0),
            duration_s=float(step.get("duration") or 0.0),
        )
        for step in raw_steps
        if float(step.get("distance") or 0.0) > 5
    ][:8]

    return EvacuationRoute(
        destination_name=destination["name"],
        destination_type=destination["type"],
        destination_latitude=destination["latitude"],
        destination_longitude=destination["longitude"],
        distance_m=float(route.get("distance") or 0.0),
        duration_s=float(route.get("duration") or 0.0),
        geometry=geometry,
        steps=steps,
        alternatives_considered=len(candidates),
        prototype_safety_score=safety_score,
        reasons=reasons,
        source="OpenStreetMap nearby facilities + OSRM road routing",
        warning="Prototype safety ranking only. It does not yet include verified live road-closure or flood-depth geometry and must not be treated as official emergency navigation.",
    )
