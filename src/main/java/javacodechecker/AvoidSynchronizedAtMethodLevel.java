public class SynchronizedCounter {   
    private int c = 0;
    // EMB-ISSUE: CodeIssueNames.AVOID_SYNCHRONIZED_AT_METHOD_LEVEL
    public synchronized void increment() {
        c++;
    }
    // EMB-ISSUE: CodeIssueNames.AVOID_SYNCHRONIZED_AT_METHOD_LEVEL
    public synchronized void decrement() {
        c--;
    }
    
    public int value() {
    	// EMB-ISSUE: CodeIssueNames.AVOID_SYNCHRONIZED_AT_METHOD_LEVEL/no-detect
    	synchronized (this) {
    		return c;
		}
        
    }
}