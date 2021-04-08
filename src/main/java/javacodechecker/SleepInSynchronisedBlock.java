package javacodechecker; 


class SleepInSynchronisedBlock {
	
	private Object lock = new Object();
	
	void m1() {
		for(int i = 0; i < 10; ++i) {

			synchronized(lock) {
				try {
					/*
					 * EMB-ISSUE:  Sleep In Synchronized Block
					 */
					Thread.sleep(10);
				} catch (InterruptedException e) {
					e.printStackTrace();
				}
			}
		}
	}
	
	public synchronized void m2() {
		try {
//			EMB-ISSUE:  Sleep In Synchronized Block
			Thread.sleep(10);
		} catch (InterruptedException e) {
			e.printStackTrace();
		}
	}
}