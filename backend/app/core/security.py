import ipaddress
import socket
from urllib.parse import urlparse
from typing import Tuple
from PIL import Image
from io import BytesIO

class SecurityException(Exception):
    pass

class SSRFBlockedException(SecurityException):
    pass

BLOCKED_IP_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),      # Loopback
    ipaddress.ip_network("10.0.0.0/8"),       # Private RFC 1918
    ipaddress.ip_network("172.16.0.0/12"),    # Private RFC 1918
    ipaddress.ip_network("192.168.0.0/16"),   # Private RFC 1918
    ipaddress.ip_network("169.254.0.0/16"),   # Link-local / Cloud metadata
    ipaddress.ip_network("0.0.0.0/8"),        # Broadcast / current net
    ipaddress.ip_network("224.0.0.0/4"),      # Multicast
    ipaddress.ip_network("240.0.0.0/4"),      # Reserved
    ipaddress.ip_network("::1/128"),          # IPv6 loopback
    ipaddress.ip_network("fc00::/7"),         # IPv6 private
    ipaddress.ip_network("fe80::/10"),        # IPv6 link-local
]

def is_ip_blocked(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
        if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_multicast or ip.is_reserved:
            return True
        for net in BLOCKED_IP_NETWORKS:
            if ip in net:
                return True
        return False
    except ValueError:
        return True

def validate_public_url(url: str) -> Tuple[bool, str]:
    """
    Validates a URL to guarantee it points to a public, non-internal, safe web resource.
    Protects against SSRF, internal port scanning, and cloud metadata access.
    """
    if not url or not isinstance(url, str):
        return False, "Empty or invalid URL"

    url = url.strip()
    try:
        parsed = urlparse(url)
    except Exception as e:
        return False, f"Malformed URL format: {str(e)}"

    if parsed.scheme.lower() not in ("http", "https"):
        return False, f"Disallowed URL scheme '{parsed.scheme}'. Only http and https are permitted."

    hostname = parsed.hostname
    if not hostname:
        return False, "URL contains no valid host name."

    # Check for localhost / numeric IP attempts
    lowered_host = hostname.lower()
    if lowered_host in ("localhost", "127.0.0.1", "0.0.0.0", "::1", "metadata.google.internal"):
        return False, f"Access to local/internal host '{hostname}' is blocked."

    # Resolve IP and verify public
    try:
        addr_info = socket.getaddrinfo(hostname, parsed.port or (443 if parsed.scheme == 'https' else 80), proto=socket.IPPROTO_TCP)
        for family, _, _, _, sockaddr in addr_info:
            ip = sockaddr[0]
            if is_ip_blocked(ip):
                return False, f"Resolved IP {ip} for {hostname} is a private/internal address."
    except socket.gaierror:
        return False, f"Could not resolve host '{hostname}'."
    except Exception as e:
        return False, f"DNS resolution check failed: {str(e)}"

    return True, "Valid public URL"


def validate_image_file_bytes(data: bytes) -> Tuple[bool, str, str]:
    """
    Validates image data to protect against malicious uploads, zip bombs, or executable payloads.
    Returns (is_valid, mime_or_format, error_msg)
    """
    if not data or len(data) == 0:
        return False, "", "File is empty"

    if len(data) > 50 * 1024 * 1024:
        return False, "", "File exceeds maximum size of 50MB"

    try:
        with Image.open(BytesIO(data)) as img:
            img.verify()
            fmt = img.format.lower() if img.format else "unknown"
            return True, fmt, ""
    except Exception as e:
        return False, "", f"Invalid or corrupted image format: {str(e)}"
