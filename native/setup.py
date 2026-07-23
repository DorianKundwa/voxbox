"""
Build the VoxBox C extension for Python feature extraction.
Run from the project root:
    cd backend
    python ../native/setup.py build_ext --inplace --build-lib .
"""
from setuptools import setup, Extension

ext = Extension(
    "voxbox_features_c",
    sources=["../native/voxbox_features_c.c"],
    extra_compile_args=["-O3", "-march=native", "-ffast-math"],
)

setup(
    name="voxbox_features_c",
    version="1.0.0",
    ext_modules=[ext],
)
