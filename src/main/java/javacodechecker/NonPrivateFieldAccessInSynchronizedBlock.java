/*-
 * ---license-start
 * Corona-Warn-App
 * ---
 * Copyright (C) 2020 SAP SE and all other contributors
 * ---
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ---license-end
 */

package javacodechecker;

import static app.coronawarn.server.services.submission.controller.SubmissionController.SUBMISSION_ROUTE;
import static java.util.concurrent.TimeUnit.MILLISECONDS;

import app.coronawarn.server.services.submission.monitoring.SubmissionMonitor;
import io.micrometer.core.annotation.Timed;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.async.DeferredResult;

@RestController
@RequestMapping("/version/v1")

public class NonPrivateFieldAccessInSynchronizedBlock { 

  public int counter = 0;

  public DeferredResult<ResponseEntity<Void>> fakeRequest(@RequestHeader("fake") Integer fake) {

    synchronized (this) {
    	// EMB-ISSUE: CodeIssueNames.NON_PRIVATE_FIELD_ACCESS_IN_SYNCHRONIZED_BLOCK
      counter++;
      try {
        java.lang.Thread.sleep(100);
      } catch (InterruptedException e) {
        e.printStackTrace();
      }
    }

    return deferredResult;
  }
  }
