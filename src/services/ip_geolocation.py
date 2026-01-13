"""
IP Geolocation Service

Uses ip-api.com for free IP geolocation (45 requests/minute, no API key needed).
Includes caching to minimize API calls and respect rate limits.
"""

import asyncio
import logging
from typing import Optional, Dict, List
from datetime import datetime, timedelta
import aiohttp

logger = logging.getLogger(__name__)

# Simple in-memory cache for IP geolocation results
_geo_cache: Dict[str, Dict] = {}
_cache_expiry: Dict[str, datetime] = {}
CACHE_TTL = timedelta(hours=24)  # Cache results for 24 hours

# Rate limiting
_last_request_time: Optional[datetime] = None
MIN_REQUEST_INTERVAL = timedelta(milliseconds=1500)  # ~40 requests/minute to stay under limit


async def geolocate_ip(ip: str) -> Optional[Dict]:
    """
    Get geolocation data for a single IP address.

    Returns dict with: lat, lon, country, countryCode, city, region, isp
    Returns None if geolocation fails or IP is private/reserved.
    """
    global _last_request_time

    # Skip private/reserved IPs
    if _is_private_ip(ip):
        return None

    # Check cache first
    if ip in _geo_cache:
        if datetime.utcnow() < _cache_expiry.get(ip, datetime.min):
            return _geo_cache[ip]
        else:
            # Cache expired
            del _geo_cache[ip]
            del _cache_expiry[ip]

    # Rate limiting
    if _last_request_time:
        elapsed = datetime.utcnow() - _last_request_time
        if elapsed < MIN_REQUEST_INTERVAL:
            await asyncio.sleep((MIN_REQUEST_INTERVAL - elapsed).total_seconds())

    try:
        async with aiohttp.ClientSession() as session:
            # ip-api.com free endpoint (no API key needed)
            url = f"http://ip-api.com/json/{ip}?fields=status,message,country,countryCode,region,city,lat,lon,isp"

            _last_request_time = datetime.utcnow()

            async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as response:
                if response.status == 200:
                    data = await response.json()

                    if data.get("status") == "success":
                        result = {
                            "lat": data.get("lat"),
                            "lon": data.get("lon"),
                            "lng": data.get("lon"),  # Alias for compatibility
                            "country": data.get("country"),
                            "countryCode": data.get("countryCode"),
                            "city": data.get("city"),
                            "region": data.get("region"),
                            "isp": data.get("isp"),
                        }

                        # Cache the result
                        _geo_cache[ip] = result
                        _cache_expiry[ip] = datetime.utcnow() + CACHE_TTL

                        return result
                    else:
                        logger.debug(f"[geo] Failed to geolocate {ip}: {data.get('message')}")
                        return None
                elif response.status == 429:
                    logger.warning("[geo] Rate limited by ip-api.com, waiting...")
                    await asyncio.sleep(60)  # Wait a minute before retrying
                    return None
                else:
                    logger.warning(f"[geo] HTTP {response.status} for {ip}")
                    return None

    except asyncio.TimeoutError:
        logger.warning(f"[geo] Timeout geolocating {ip}")
        return None
    except Exception as e:
        logger.warning(f"[geo] Error geolocating {ip}: {e}")
        return None


async def batch_geolocate_ips(ips: List[str], max_ips: int = 15) -> Dict[str, Dict]:
    """
    Geolocate multiple IPs with rate limiting.

    Args:
        ips: List of IP addresses to geolocate
        max_ips: Maximum number of IPs to process (to respect rate limits)

    Returns:
        Dict mapping IP -> geolocation data
    """
    results = {}
    unique_ips = list(set(ips))[:max_ips]  # Dedupe and limit

    for ip in unique_ips:
        # Skip if already cached
        if ip in _geo_cache and datetime.utcnow() < _cache_expiry.get(ip, datetime.min):
            results[ip] = _geo_cache[ip]
            continue

        # Skip private IPs
        if _is_private_ip(ip):
            continue

        geo = await geolocate_ip(ip)
        if geo:
            results[ip] = geo

    return results


def _is_private_ip(ip: str) -> bool:
    """Check if an IP address is private/reserved."""
    try:
        parts = ip.split(".")
        if len(parts) != 4:
            return True

        first = int(parts[0])
        second = int(parts[1])

        # Private ranges
        if first == 10:  # 10.0.0.0/8
            return True
        if first == 172 and 16 <= second <= 31:  # 172.16.0.0/12
            return True
        if first == 192 and second == 168:  # 192.168.0.0/16
            return True
        if first == 127:  # Loopback
            return True
        if first == 0:  # Reserved
            return True
        if first >= 224:  # Multicast/Reserved
            return True

        return False
    except (ValueError, IndexError):
        return True


def clear_cache():
    """Clear the geolocation cache."""
    global _geo_cache, _cache_expiry
    _geo_cache = {}
    _cache_expiry = {}
