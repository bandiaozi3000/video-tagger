package com.videotagger.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ClipTimeValidationTest {
    @Test
    void missingEndIsCompatible() {
        assertEquals(null, ClipService.validateEndSec(10.0, null, 100.0));
    }

    @Test
    void endMustBeAfterStart() {
        assertThrows(IllegalArgumentException.class,
                () -> ClipService.validateEndSec(10.0, 10.0, 100.0));
    }

    @Test
    void endCannotExceedDuration() {
        assertThrows(IllegalArgumentException.class,
                () -> ClipService.validateEndSec(10.0, 101.0, 100.0));
    }

    @Test
    void startCannotExceedDuration() {
        assertThrows(IllegalArgumentException.class,
                () -> ClipService.validateEndSec(101.0, null, 100.0));
    }
}
