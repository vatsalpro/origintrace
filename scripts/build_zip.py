import os
import sys
import zipfile
from pathlib import Path

def create_project_zip(zip_name: str = "hack3"):
    root_dir = Path(r"E:\new hackathon")
    desktop_dir = Path(r"C:\Users\Vatsal Kumar\Desktop")
    desktop_zip = desktop_dir / f"{zip_name}.zip"
    
    exclude_dirs = {
        "venv",
        "node_modules",
        "dist",
        ".git",
        ".pytest_cache",
        "__pycache__",
        "cache",
    }
    exclude_files = {
        ".env",
        "new hack2.zip",
        "hack3.zip",
    }
    exclude_extensions = {
        ".pyc",
        ".pyo",
        ".tmp",
    }
    
    # Temporary zip first to avoid corruption
    temp_zip = desktop_zip.with_suffix(".tmp.zip")
    if temp_zip.exists():
        temp_zip.unlink()
        
    print(f"Archiving {root_dir} into {desktop_zip} with root folder '{zip_name}'...")
    file_count = 0
    with zipfile.ZipFile(temp_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(root_dir):
            # Modify dirs in-place to avoid traversing excluded dirs
            dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith(".")]
            
            rel_dir = Path(root).relative_to(root_dir)
            
            for file in files:
                if file in exclude_files or file.endswith(".zip"):
                    continue
                ext = Path(file).suffix.lower()
                if ext in exclude_extensions:
                    continue
                    
                file_path = Path(root) / file
                arcname = Path(zip_name) / rel_dir / file
                zf.write(file_path, str(arcname).replace("\\", "/"))
                file_count += 1
                if file_count % 1000 == 0:
                    print(f"Added {file_count} files...")
                    
    if desktop_zip.exists():
        desktop_zip.unlink()
    temp_zip.rename(desktop_zip)
    size_mb = desktop_zip.stat().st_size / (1024 * 1024)
    print(f"Archive successfully generated: {desktop_zip} ({size_mb:.2f} MB, {file_count} files)")

if __name__ == "__main__":
    name = sys.argv[1] if len(sys.argv) > 1 else "hack3"
    create_project_zip(name)
