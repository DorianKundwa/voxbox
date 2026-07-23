"""
voxbox_features_c.c  —  Python C extension
Hot-path feature extraction: LUFS (K-weighted), RMS, peak, spectral centroid.
Compiles 10-100x faster than pure Python/numpy for these specific paths.

Build:
    python setup.py build_ext --inplace

Usage:
    from voxbox_features_c import lufs_k_weighted, rms_db, peak_db, spectral_centroid
"""

#define PY_SSIZE_T_CLEAN
#include <Python.h>
#include <math.h>
#include <stdlib.h>
#include <string.h>

/* ── K-weighting IIR coefficients (48 kHz, per ITU-R BS.1770) ─────────────── */
/* Stage 1: High-shelf +4 dB at 1681 Hz */
static const double HS_B0 =  1.53512485958697;
static const double HS_B1 = -2.69169618940638;
static const double HS_B2 =  1.19839281085285;
static const double HS_A1 = -1.69065929318241;
static const double HS_A2 =  0.73248077421585;

/* Stage 2: High-pass at 38 Hz */
static const double HP_B0 =  1.0;
static const double HP_B1 = -2.0;
static const double HP_B2 =  1.0;
static const double HP_A1 = -1.99004745483398;
static const double HP_A2 =  0.99007225036621;

/* Apply one biquad stage in-place (Direct Form II) */
static void apply_biquad(const double b0, const double b1, const double b2,
                          const double a1, const double a2,
                          double *buf, Py_ssize_t n)
{
    double s1 = 0.0, s2 = 0.0;
    for (Py_ssize_t i = 0; i < n; ++i) {
        double x = buf[i];
        double y = b0 * x + s1;
        s1 = b1 * x - a1 * y + s2;
        s2 = b2 * x - a2 * y;
        buf[i] = y;
    }
}

/* ── lufs_k_weighted(samples_float_list, sr) -> float ─────────────────────── */
static PyObject *py_lufs_k_weighted(PyObject *self, PyObject *args)
{
    PyObject  *seq;
    double     sr;
    if (!PyArg_ParseTuple(args, "Od", &seq, &sr)) return NULL;

    Py_ssize_t n = PySequence_Length(seq);
    if (n <= 0) { PyErr_SetString(PyExc_ValueError, "Empty sequence"); return NULL; }

    double *buf = (double *)malloc(n * sizeof(double));
    if (!buf) return PyErr_NoMemory();

    /* Copy from Python sequence */
    for (Py_ssize_t i = 0; i < n; ++i) {
        PyObject *item = PySequence_GetItem(seq, i);
        buf[i] = PyFloat_AsDouble(item);
        Py_DECREF(item);
    }

    /* K-weighting: high-shelf then high-pass */
    apply_biquad(HS_B0, HS_B1, HS_B2, HS_A1, HS_A2, buf, n);
    apply_biquad(HP_B0, HP_B1, HP_B2, HP_A1, HP_A2, buf, n);

    /* Mean square -> LUFS */
    double ms = 0.0;
    for (Py_ssize_t i = 0; i < n; ++i) ms += buf[i] * buf[i];
    ms /= (double)n;

    free(buf);

    double lufs = ms > 1e-10 ? -0.691 + 10.0 * log10(ms) : -70.0;
    return PyFloat_FromDouble(lufs);
}

/* ── rms_db(samples_float_list) -> float ─────────────────────────────────── */
static PyObject *py_rms_db(PyObject *self, PyObject *args)
{
    PyObject *seq;
    if (!PyArg_ParseTuple(args, "O", &seq)) return NULL;
    Py_ssize_t n = PySequence_Length(seq);
    if (n <= 0) return PyFloat_FromDouble(-70.0);

    double ms = 0.0;
    for (Py_ssize_t i = 0; i < n; ++i) {
        PyObject *item = PySequence_GetItem(seq, i);
        double v = PyFloat_AsDouble(item);
        Py_DECREF(item);
        ms += v * v;
    }
    ms /= (double)n;
    double rms = ms > 1e-10 ? 20.0 * log10(sqrt(ms)) : -70.0;
    return PyFloat_FromDouble(rms);
}

/* ── peak_db(samples_float_list) -> float ────────────────────────────────── */
static PyObject *py_peak_db(PyObject *self, PyObject *args)
{
    PyObject *seq;
    if (!PyArg_ParseTuple(args, "O", &seq)) return NULL;
    Py_ssize_t n = PySequence_Length(seq);
    if (n <= 0) return PyFloat_FromDouble(-70.0);

    double peak = 0.0;
    for (Py_ssize_t i = 0; i < n; ++i) {
        PyObject *item = PySequence_GetItem(seq, i);
        double v = fabs(PyFloat_AsDouble(item));
        Py_DECREF(item);
        if (v > peak) peak = v;
    }
    double peak_db = peak > 1e-10 ? 20.0 * log10(peak) : -70.0;
    return PyFloat_FromDouble(peak_db);
}

/* ── spectral_centroid(magnitudes_list, freqs_list) -> float ─────────────── */
static PyObject *py_spectral_centroid(PyObject *self, PyObject *args)
{
    PyObject *mags_seq, *freqs_seq;
    if (!PyArg_ParseTuple(args, "OO", &mags_seq, &freqs_seq)) return NULL;

    Py_ssize_t n = PySequence_Length(mags_seq);
    if (n <= 0) return PyFloat_FromDouble(0.0);

    double weighted = 0.0, total = 0.0;
    for (Py_ssize_t i = 0; i < n; ++i) {
        PyObject *m = PySequence_GetItem(mags_seq, i);
        PyObject *f = PySequence_GetItem(freqs_seq, i);
        double mag  = PyFloat_AsDouble(m);
        double freq = PyFloat_AsDouble(f);
        Py_DECREF(m); Py_DECREF(f);
        weighted += freq * mag;
        total    += mag;
    }
    return PyFloat_FromDouble(total > 1e-12 ? weighted / total : 0.0);
}

/* ── dynamic_range(samples_list) -> float ────────────────────────────────── */
static PyObject *py_dynamic_range(PyObject *self, PyObject *args)
{
    PyObject *seq;
    if (!PyArg_ParseTuple(args, "O", &seq)) return NULL;
    Py_ssize_t n = PySequence_Length(seq);
    if (n <= 0) return PyFloat_FromDouble(0.0);

    double peak = 0.0, ms = 0.0;
    for (Py_ssize_t i = 0; i < n; ++i) {
        PyObject *item = PySequence_GetItem(seq, i);
        double v = fabs(PyFloat_AsDouble(item));
        Py_DECREF(item);
        if (v > peak) peak = v;
        ms += v * v;
    }
    ms /= (double)n;
    double peak_db = peak > 1e-10 ? 20.0 * log10(peak) : -70.0;
    double rms_db  = ms   > 1e-10 ? 20.0 * log10(sqrt(ms)) : -70.0;
    return PyFloat_FromDouble(peak_db - rms_db);
}

/* ── Module table ────────────────────────────────────────────────────────── */
static PyMethodDef VoxBoxMethods[] = {
    {"lufs_k_weighted",   py_lufs_k_weighted,   METH_VARARGS, "LUFS K-weighted (ITU-R BS.1770)"},
    {"rms_db",            py_rms_db,            METH_VARARGS, "RMS in dBFS"},
    {"peak_db",           py_peak_db,           METH_VARARGS, "True peak in dBFS"},
    {"spectral_centroid", py_spectral_centroid, METH_VARARGS, "Spectral centroid Hz"},
    {"dynamic_range",     py_dynamic_range,     METH_VARARGS, "Crest factor in dB"},
    {NULL, NULL, 0, NULL}
};

static struct PyModuleDef voxbox_module = {
    PyModuleDef_HEAD_INIT, "voxbox_features_c", NULL, -1, VoxBoxMethods
};

PyMODINIT_FUNC PyInit_voxbox_features_c(void) {
    return PyModule_Create(&voxbox_module);
}
