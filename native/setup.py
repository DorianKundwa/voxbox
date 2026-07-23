import sys
from setuptools import setup, Extension

# MSVC (Windows) uses /O2, GCC/Clang use -O3
if sys.platform == "win32":
    extra = ["/O2", "/GL"]
else:
    extra = ["-O3", "-march=native", "-ffast-math"]

ext = Extension(
    "voxbox_features_c",
    sources=["../native/voxbox_features_c.c"],
    extra_compile_args=extra,
)

setup(
    name="voxbox_features_c",
    version="1.0.0",
    ext_modules=[ext],
)
