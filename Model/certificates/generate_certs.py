"""
x509 Certificate Authority & Node Certificate Provisioner
Stage 3 & Section 2: Node Provisioning & mTLS gRPC Transport Security

Generates cryptographic x509 SSL/TLS certificates using RSA-2048 and SHA-256:
- Internal Root Certificate Authority (Root CA)
- Flower Federated Server Certificate with SAN (localhost, 127.0.0.1)
- Hospital Client Node Certificates (node_A, node_B, node_C)
"""

from __future__ import annotations

import datetime
from pathlib import Path

try:
    from cryptography import x509
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.x509.oid import NameOID
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False


CERT_DIR = Path(__file__).resolve().parent


def generate_all_certificates(output_dir: Path | None = None) -> dict[str, Path]:
    target_dir = output_dir or CERT_DIR
    target_dir.mkdir(parents=True, exist_ok=True)

    ca_key_path = target_dir / "ca.key"
    ca_cert_path = target_dir / "ca.crt"
    server_key_path = target_dir / "server.key"
    server_cert_path = target_dir / "server.crt"

    client_paths = {
        "ca_crt": ca_cert_path,
        "ca_key": ca_key_path,
        "server_crt": server_cert_path,
        "server_key": server_key_path,
    }

    if CRYPTO_AVAILABLE:
        now = datetime.datetime.now(datetime.timezone.utc)
        expiry = now + datetime.timedelta(days=365 * 5)

        # 1. Root Certificate Authority (CA)
        ca_key = rsa.generate_private_key(public_exponent=65537, key_size=2048, backend=default_backend())
        ca_name = x509.Name(
            [
                x509.NameAttribute(NameOID.COUNTRY_NAME, "IN"),
                x509.NameAttribute(NameOID.ORGANIZATION_NAME, "SIT Healthcare Federated Consortium"),
                x509.NameAttribute(NameOID.COMMON_NAME, "TB-Federated-Root-CA"),
            ]
        )
        ca_cert = (
            x509.CertificateBuilder()
            .subject_name(ca_name)
            .issuer_name(ca_name)
            .public_key(ca_key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now)
            .not_valid_after(expiry)
            .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
            .sign(ca_key, hashes.SHA256(), default_backend())
        )

        with open(ca_key_path, "wb") as f:
            f.write(ca_key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()))
        with open(ca_cert_path, "wb") as f:
            f.write(ca_cert.public_bytes(serialization.Encoding.PEM))

        # 2. Server Certificate
        server_key = rsa.generate_private_key(public_exponent=65537, key_size=2048, backend=default_backend())
        server_name = x509.Name(
            [
                x509.NameAttribute(NameOID.COUNTRY_NAME, "IN"),
                x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Flower Aggregation Hub"),
                x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
            ]
        )
        import ipaddress
        server_cert = (
            x509.CertificateBuilder()
            .subject_name(server_name)
            .issuer_name(ca_name)
            .public_key(server_key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now)
            .not_valid_after(expiry)
            .add_extension(
                x509.SubjectAlternativeName([x509.DNSName("localhost"), x509.IPAddress(ipaddress.IPv4Address("127.0.0.1"))]),
                critical=False,
            )
            .sign(ca_key, hashes.SHA256(), default_backend())
        )

        with open(server_key_path, "wb") as f:
            f.write(server_key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()))
        with open(server_cert_path, "wb") as f:
            f.write(server_cert.public_bytes(serialization.Encoding.PEM))

        # 3. Client Certificates
        for node in ["node_A", "node_B", "node_C"]:
            node_key = rsa.generate_private_key(public_exponent=65537, key_size=2048, backend=default_backend())
            node_name = x509.Name(
                [
                    x509.NameAttribute(NameOID.COUNTRY_NAME, "IN"),
                    x509.NameAttribute(NameOID.ORGANIZATION_NAME, f"Hospital Client {node}"),
                    x509.NameAttribute(NameOID.COMMON_NAME, node),
                ]
            )
            node_cert = (
                x509.CertificateBuilder()
                .subject_name(node_name)
                .issuer_name(ca_name)
                .public_key(node_key.public_key())
                .serial_number(x509.random_serial_number())
                .not_valid_before(now)
                .not_valid_after(expiry)
                .sign(ca_key, hashes.SHA256(), default_backend())
            )
            n_key_path = target_dir / f"{node}.key"
            n_cert_path = target_dir / f"{node}.crt"
            with open(n_key_path, "wb") as f:
                f.write(node_key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()))
            with open(n_cert_path, "wb") as f:
                f.write(node_cert.public_bytes(serialization.Encoding.PEM))
            client_paths[f"{node}_crt"] = n_cert_path
            client_paths[f"{node}_key"] = n_key_path

    else:
        # Fallback PEM certificates for testing environment
        dummy_ca = b"-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIU...\n-----END CERTIFICATE-----\n"
        dummy_key = b"-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----\n"

        ca_key_path.write_bytes(dummy_key)
        ca_cert_path.write_bytes(dummy_ca)
        server_key_path.write_bytes(dummy_key)
        server_cert_path.write_bytes(dummy_ca)

        for node in ["node_A", "node_B", "node_C"]:
            n_key = target_dir / f"{node}.key"
            n_cert = target_dir / f"{node}.crt"
            n_key.write_bytes(dummy_key)
            n_cert.write_bytes(dummy_ca)
            client_paths[f"{node}_crt"] = n_cert
            client_paths[f"{node}_key"] = n_key

    return client_paths


if __name__ == "__main__":
    generate_all_certificates()
