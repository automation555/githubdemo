package javacodechecker; 

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class PossibleThreadLeakInExecutorService {    
    ExecutorService executorService2 =  Executors.newSingleThreadExecutor(); 

    public void process1() {

        System.out.println("test");
        System.out.println("test");

        System.out.println("test");
        System.out.println("test");

        executorService2.shutdown();
    }
    
    public void process2() {
        System.out.println("test");
        System.out.println("test");

		// EMB-ISSUE: CodeIssueNames.POSSIBLE_THREAD_LEAK_IN_EXECUTOR_SERVICE
        ExecutorService executorService =  Executors.newSingleThreadExecutor(); 
        executorService.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    System.out.println("test");
                    // doTask();
                } catch (Exception e) {
                    //logger.error("indexing failed", e);
                }
            }
        });
        System.out.println("test");
        System.out.println("test");
    }
}
