"""A2A Security Module.

Implements agent card signing and verification using Ed25519 signatures
as recommended by the A2A Protocol v0.3 specification.

Features:
- Ed25519 key pair generation and management
- Agent card signing with detached signatures
- Signature verification for incoming agent cards
- Key rotation support
"""

import logging
import json
import base64
import hashlib
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.hazmat.primitives import serialization
from cryptography.exceptions import InvalidSignature

logger = logging.getLogger(__name__)


@dataclass
class SignedAgentCard:
    """An agent card with its signature."""
    card: Dict[str, Any]
    signature: str  # Base64-encoded Ed25519 signature
    public_key: str  # Base64-encoded public key
    signed_at: str  # ISO timestamp
    key_id: str  # Identifier for the signing key


class A2ASecurityManager:
    """Manages cryptographic operations for A2A agent cards.

    Handles:
    - Key generation and storage
    - Card signing
    - Signature verification
    - Key rotation
    """

    def __init__(
        self,
        keys_dir: Optional[str] = None,
        key_rotation_days: int = 90,
    ):
        self._keys_dir = Path(keys_dir) if keys_dir else None
        self._key_rotation_days = key_rotation_days
        self._private_key: Optional[Ed25519PrivateKey] = None
        self._public_key: Optional[Ed25519PublicKey] = None
        self._key_id: Optional[str] = None
        self._key_created_at: Optional[datetime] = None

        # Trusted public keys for verification (agent_id -> public_key)
        self._trusted_keys: Dict[str, Ed25519PublicKey] = {}

    def _generate_key_id(self, public_key: Ed25519PublicKey) -> str:
        """Generate a key ID from the public key (first 8 chars of SHA256)."""
        public_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
        hash_bytes = hashlib.sha256(public_bytes).digest()
        return base64.urlsafe_b64encode(hash_bytes)[:8].decode()

    def generate_key_pair(self) -> Tuple[str, str]:
        """Generate a new Ed25519 key pair.

        Returns:
            Tuple of (public_key_base64, key_id)
        """
        self._private_key = Ed25519PrivateKey.generate()
        self._public_key = self._private_key.public_key()
        self._key_id = self._generate_key_id(self._public_key)
        self._key_created_at = datetime.utcnow()

        public_key_b64 = base64.b64encode(
            self._public_key.public_bytes(
                encoding=serialization.Encoding.Raw,
                format=serialization.PublicFormat.Raw,
            )
        ).decode()

        logger.info(f"[Security] Generated new key pair: {self._key_id}")
        return public_key_b64, self._key_id

    def load_or_generate_keys(self) -> Tuple[str, str]:
        """Load existing keys or generate new ones.

        Returns:
            Tuple of (public_key_base64, key_id)
        """
        if self._keys_dir:
            private_key_path = self._keys_dir / "a2a_private_key.pem"
            public_key_path = self._keys_dir / "a2a_public_key.pem"
            metadata_path = self._keys_dir / "a2a_key_metadata.json"

            if private_key_path.exists():
                try:
                    # Load existing keys
                    with open(private_key_path, "rb") as f:
                        self._private_key = serialization.load_pem_private_key(
                            f.read(), password=None
                        )
                    self._public_key = self._private_key.public_key()
                    self._key_id = self._generate_key_id(self._public_key)

                    # Load metadata
                    if metadata_path.exists():
                        with open(metadata_path, "r") as f:
                            metadata = json.load(f)
                            self._key_created_at = datetime.fromisoformat(
                                metadata.get("created_at", datetime.utcnow().isoformat())
                            )

                    public_key_b64 = base64.b64encode(
                        self._public_key.public_bytes(
                            encoding=serialization.Encoding.Raw,
                            format=serialization.PublicFormat.Raw,
                        )
                    ).decode()

                    logger.info(f"[Security] Loaded existing key pair: {self._key_id}")
                    return public_key_b64, self._key_id

                except Exception as e:
                    logger.warning(f"[Security] Failed to load keys, generating new: {e}")

        # Generate new keys
        public_key_b64, key_id = self.generate_key_pair()

        # Save if keys_dir is set
        if self._keys_dir:
            self._keys_dir.mkdir(parents=True, exist_ok=True)
            self._save_keys()

        return public_key_b64, key_id

    def _save_keys(self):
        """Save keys to disk."""
        if not self._keys_dir or not self._private_key:
            return

        private_key_path = self._keys_dir / "a2a_private_key.pem"
        public_key_path = self._keys_dir / "a2a_public_key.pem"
        metadata_path = self._keys_dir / "a2a_key_metadata.json"

        # Save private key
        private_pem = self._private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
        with open(private_key_path, "wb") as f:
            f.write(private_pem)
        private_key_path.chmod(0o600)  # Restrict permissions

        # Save public key
        public_pem = self._public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        with open(public_key_path, "wb") as f:
            f.write(public_pem)

        # Save metadata
        metadata = {
            "key_id": self._key_id,
            "created_at": self._key_created_at.isoformat() if self._key_created_at else None,
            "algorithm": "Ed25519",
        }
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)

        logger.info(f"[Security] Saved key pair to {self._keys_dir}")

    def needs_rotation(self) -> bool:
        """Check if the current key needs rotation."""
        if not self._key_created_at:
            return False
        age = datetime.utcnow() - self._key_created_at
        return age > timedelta(days=self._key_rotation_days)

    def rotate_keys(self) -> Tuple[str, str]:
        """Rotate to a new key pair.

        The old key is kept in trusted_keys for verification during transition.

        Returns:
            Tuple of (new_public_key_base64, new_key_id)
        """
        # Keep old public key as trusted for transition period
        if self._public_key and self._key_id:
            self._trusted_keys[f"self:{self._key_id}"] = self._public_key

        # Generate new keys
        public_key_b64, key_id = self.generate_key_pair()

        # Save new keys
        if self._keys_dir:
            self._save_keys()

        logger.info(f"[Security] Rotated keys: new key_id={key_id}")
        return public_key_b64, key_id

    def sign_agent_card(self, card: Dict[str, Any]) -> SignedAgentCard:
        """Sign an agent card.

        Args:
            card: The agent card dictionary to sign

        Returns:
            SignedAgentCard with detached signature
        """
        if not self._private_key:
            self.load_or_generate_keys()

        # Canonical JSON serialization for deterministic signing
        canonical_json = json.dumps(card, sort_keys=True, separators=(",", ":"))
        message = canonical_json.encode("utf-8")

        # Sign the message
        signature = self._private_key.sign(message)
        signature_b64 = base64.b64encode(signature).decode()

        # Get public key for inclusion
        public_key_b64 = base64.b64encode(
            self._public_key.public_bytes(
                encoding=serialization.Encoding.Raw,
                format=serialization.PublicFormat.Raw,
            )
        ).decode()

        signed_at = datetime.utcnow().isoformat()

        return SignedAgentCard(
            card=card,
            signature=signature_b64,
            public_key=public_key_b64,
            signed_at=signed_at,
            key_id=self._key_id,
        )

    def verify_signature(
        self,
        card: Dict[str, Any],
        signature_b64: str,
        public_key_b64: str,
    ) -> bool:
        """Verify an agent card signature.

        Args:
            card: The agent card dictionary
            signature_b64: Base64-encoded signature
            public_key_b64: Base64-encoded public key

        Returns:
            True if signature is valid, False otherwise
        """
        try:
            # Decode public key
            public_key_bytes = base64.b64decode(public_key_b64)
            public_key = Ed25519PublicKey.from_public_bytes(public_key_bytes)

            # Canonical JSON for verification
            canonical_json = json.dumps(card, sort_keys=True, separators=(",", ":"))
            message = canonical_json.encode("utf-8")

            # Decode signature
            signature = base64.b64decode(signature_b64)

            # Verify
            public_key.verify(signature, message)
            return True

        except InvalidSignature:
            logger.warning("[Security] Invalid signature")
            return False
        except Exception as e:
            logger.error(f"[Security] Verification error: {e}")
            return False

    def add_trusted_key(self, agent_id: str, public_key_b64: str):
        """Add a trusted public key for an external agent.

        Args:
            agent_id: The agent's ID
            public_key_b64: Base64-encoded Ed25519 public key
        """
        try:
            public_key_bytes = base64.b64decode(public_key_b64)
            public_key = Ed25519PublicKey.from_public_bytes(public_key_bytes)
            self._trusted_keys[agent_id] = public_key
            logger.info(f"[Security] Added trusted key for agent: {agent_id}")
        except Exception as e:
            logger.error(f"[Security] Failed to add trusted key for {agent_id}: {e}")
            raise

    def remove_trusted_key(self, agent_id: str):
        """Remove a trusted public key."""
        if agent_id in self._trusted_keys:
            del self._trusted_keys[agent_id]
            logger.info(f"[Security] Removed trusted key for agent: {agent_id}")

    def is_trusted_agent(self, agent_id: str) -> bool:
        """Check if an agent has a trusted public key."""
        return agent_id in self._trusted_keys

    def get_trusted_agents(self) -> list:
        """Get list of trusted agent IDs."""
        return list(self._trusted_keys.keys())

    def verify_signed_card(self, signed_card: SignedAgentCard) -> bool:
        """Verify a SignedAgentCard object."""
        return self.verify_signature(
            signed_card.card,
            signed_card.signature,
            signed_card.public_key,
        )

    def get_public_key_info(self) -> Dict[str, Any]:
        """Get information about the current public key."""
        if not self._public_key:
            return {"error": "No key pair generated"}

        public_key_b64 = base64.b64encode(
            self._public_key.public_bytes(
                encoding=serialization.Encoding.Raw,
                format=serialization.PublicFormat.Raw,
            )
        ).decode()

        return {
            "key_id": self._key_id,
            "public_key": public_key_b64,
            "algorithm": "Ed25519",
            "created_at": self._key_created_at.isoformat() if self._key_created_at else None,
            "needs_rotation": self.needs_rotation(),
        }


# Singleton instance
_security_manager: Optional[A2ASecurityManager] = None


def get_security_manager() -> A2ASecurityManager:
    """Get the singleton security manager instance."""
    global _security_manager
    if _security_manager is None:
        # Use data directory for key storage if available
        from src.config.settings import get_settings
        settings = get_settings()

        keys_dir = None
        if hasattr(settings, "data_dir") and settings.data_dir:
            keys_dir = str(Path(settings.data_dir) / "keys")

        _security_manager = A2ASecurityManager(keys_dir=keys_dir)
    return _security_manager


def init_security_manager(keys_dir: Optional[str] = None) -> A2ASecurityManager:
    """Initialize security manager with optional custom keys directory."""
    global _security_manager
    _security_manager = A2ASecurityManager(keys_dir=keys_dir)
    _security_manager.load_or_generate_keys()
    return _security_manager
